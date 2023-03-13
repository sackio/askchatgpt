function uuidv4() {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  return uuid;
}

async function fetchSSE(resource, options) {
  const { onMessage, ...fetchOptions } = options;
  const resp = await fetch(resource, fetchOptions);
  if (!resp.ok) {
    const error = await resp.json().catch(() => ({}));
    throw new Error(
        error && error.message
        ? JSON.stringify(error)
        : `${resp.status} ${resp.statusText}`
    );
  }
  let data;
  for await (const chunk of streamAsyncIterable(resp.body)) {
    let str = new TextDecoder().decode(chunk);
    
    str = str.replace(/^data: /, '');

    if (str === '[DONE]') {
      break;
    }

    try {
      data = JSON.parse(str);
      await options.onMessage(data);
    } catch (e) {
      
    }
  }
  
  return data;
}

async function* streamAsyncIterable(stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

async function request(token, method, path, data) {
  return fetch(`https://chat.openai.com/backend-api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

async function sendMessageFeedback(token, data) {
  await request(token, 'POST', '/conversation/message_feedback', data);
}

async function setConversationProperty(token, conversationId, propertyObject) {
  await request(token, 'PATCH', `/conversation/${conversationId}`, propertyObject);
}

async function getChatGPTAccessToken() {
  const {chatgpt_access_token, chatgpt_access_token_created_at} = await browser.storage.local.get([
    'chatgpt_access_token'
  , 'chatgpt_access_token_created_at'
  ]);

  if (chatgpt_access_token && chatgpt_access_token_created_at 
     && (new Date().valueOf() - chatgpt_access_token_created_at <= 60 * 1000 * 15)) {
    return chatgpt_access_token;
  }

  const resp = await fetch('https://chat.openai.com/api/auth/session');
  if (resp.status === 403) {
    throw new Error('CLOUDFLARE');
  }
  const data = await resp.json().catch(() => ({}));
  if (!data.accessToken) {
    throw new Error(data?.details || 'UNAUTHORIZED');
  }

  await browser.storage.local.set({
    chatgpt_access_token: data.accessToken
  , chatgpt_access_token_created_at: new Date().valueOf()
  });

  return data.accessToken;
}

async function hideConversation(conversationId) {
  let token = await getChatGPTAccessToken();
  await setConversationProperty(token, conversationId, { is_visible: false });
}

class ChatGPTProvider {
  constructor(token, conversationId, parentMsgId, modelName) {
    this.token = token;
    this.conversationId = conversationId;
    this.parentMsgId = parentMsgId;
    this.modelName = modelName;
  }

  async fetchModels() {
    const resp = await request(this.token, 'GET', '/models').then((r) => r.json());
    return resp.models;
  }

  async getModelName() {
    try {
      const models = await this.fetchModels();
      return models[0].slug;
    } catch (err) {
      console.error(err);
      return 'text-davinci-002-render';
    }
  }

  async generateAnswer(params) {
    const cleanup = () => {
      if (this.conversationId) {
        setConversationProperty(this.token, this.conversationId, { is_visible: false });
      }
    };

    const modelName = this.modelName || await this.getModelName()
        , body = {
            action: 'next',
            messages: [
              {
                id: uuidv4(),
                role: 'user',
                content: {
                  content_type: 'text',
                  parts: [params.prompt],
                },
              },
            ],
            model: modelName,
            parent_message_id: this.parentMsgId || uuidv4(),
          };

    if (this.conversationId) body.conversation_id = this.conversationId;

    let stream_answer;

    const answer = await fetchSSE('https://chat.openai.com/backend-api/conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body)
    , onMessage: async data => {
        this.conversationId = data?.conversation_id;
        this.parentMsgId = data?.message?.id;

        if (params.onMessage) await params.onMessage(data);
        stream_answer = data;
      }
    }) || stream_answer;

    this.conversationId = answer?.conversation_id;
    this.parentMsgId = answer?.message?.id;

    return { cleanup, answer };
  }
}

function sendMessage(tabId, data) {
  if (tabId) {
    browser.tabs.sendMessage(tabId, data);
  } else {
    browser.runtime.sendMessage(data);        
  }
}

browser.runtime.onMessage.addListener(async (request, sender) => {
  if (request.message === 'chatgpt:conversation:end') {
    if (!request?.data?.conversation_id) {
      sendMessage(sender?.tab?.id, {
        message: 'chatgpt:conversation:end'
      , data: {
          parent_message: request.data
        , error: 'conversation_id is required'
        }
      });      

      return;
    }

    try {
      await hideConversation(request.data.conversation_id)

      sendMessage(sender?.tab?.id, {
        message: 'chatgpt:conversation:ended'
      , data: {
          parent_message: request.data
        , conversation_id: request.data.conversation_id
        }
      });

    } catch (e) {
      console.log(e);

      sendMessage(sender?.tab?.id, {
        message: 'chatgpt:conversation:ended'
      , data: {
          parent_message: request.data
        , conversation_id: request.data.conversation_id
        , error: e.message
        }
      });
    }

  }

  if (request.message === 'chatgpt:prompt') {
    if (!request?.data?.prompt) {

      sendMessage(sender?.tab?.id, {
        message: 'chatgpt:answer'
      , data: {
          parent_message: request.data
        , error: 'prompt is required'
        }
      });      

      return;
    }
    try {
      const token = await getChatGPTAccessToken()
          , provider = new ChatGPTProvider(token
                                         , request.data.conversation_id
                                         , request.data.parent_message_id
                                         , request.data.model_name)
          , {cleanup, answer} = await provider.generateAnswer({
              prompt: request.data.prompt
            , onMessage: answ => {
                sendMessage(sender?.tab?.id, {
                  message: 'chatgpt:answer:stream'
                , data: {
                    parent_message: request.data
                  , answer: answ
                  }
                });
              }
            });

      if (!request?.data?.keep_visible) cleanup();

      sendMessage(sender?.tab?.id, {
        message: 'chatgpt:answer'
      , data: {
          parent_message: request.data
        , answer
        }
      });

    } catch (e) {
      console.log(e);

      sendMessage(sender?.tab?.id, {
        message: 'chatgpt:answer'
      , data: {
          parent_message: request.data
        , error: e.message
        }
      });      

      // browser.tabs.create({ 
      //   url: 'https://chat.openai.com/chat'
      // });

      browser.storage.local.remove([
        'chatgpt_access_token'
      , 'chatgpt_access_token_created_at'
      ]);
    }
  }
});
