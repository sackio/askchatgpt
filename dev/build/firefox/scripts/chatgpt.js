function uuidv4() {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  return uuid;
}

function askChatGPT(params) {
  return new Promise((res, rej) => {
    const id = uuidv4();

    const answer_handle = e => {
      if (e?.detail?.parent_message?.id !== id) return;
      if (e.detail.error) return rej(new Error(e.detail.error));

      document.removeEventListener('chatgpt:answer', answer_handle);
      document.removeEventListener('chatgpt:answer:stream', stream_handle);

      try {
        res({
          answer: e.detail.answer.message.content.parts.join('')
        , data: e.detail.answer
        });
      } catch (err) {
        rej(err);
      }
    };

    const stream_handle = e => {
      if (e?.detail?.parent_message?.id !== id) return;
      if (e.detail.error) return rej(new Error(e.detail.error));

      if (params.stream_handle) params.stream_handle({
        answer: e.detail.answer.message.content.parts.join('')
      , data: e.detail.answer
      });
    }

    document.addEventListener('chatgpt:answer', answer_handle);
    document.addEventListener('chatgpt:answer:stream', stream_handle);

    const event = new CustomEvent('chatgpt:prompt', {
      detail: {
        prompt: params.prompt
      , id
      , conversation_id: params.conversation_id
      , parent_message_id: params.parent_message_id
      , model_name: params.model_name
      , keep_visible: params.keep_visible
      }
    });

    document.dispatchEvent(event);
  });
}

function endChatGPTConversation(params) {
  return new Promise((res, rej) => {
    const id = uuidv4();

    const handle = e => {
      if (e?.detail?.parent_message?.id !== id) return;
      if (e.detail.error) return rej(new Error(e.detail.error));

      document.removeEventListener('chatgpt:conversation:ended', answer_handle);

      try {
        res(e.detail);
      } catch (err) {
        rej(err);
      }
    };

    document.addEventListener('chatgpt:conversation:ended', handle);

    const event = new CustomEvent('chatgpt:conversation:end', {
      detail: {
        conversation_id: params.conversation_id
      }
    });

    document.dispatchEvent(event);
  });
}

class ChatGPTConversation {
  constructor(params={}) {
    this.conversation_id = params.conversation_id;
    this.parent_message_id = params.parent_message_id;
    this.model_name = params.model_name;
    this.keep_visible = params.keep_visible;
  }

  async ask(prompt, stream_handle) {
    let stream_h = e => {
      this.conversation_id = e?.data?.conversation_id;
      this.parent_message_id = e?.data?.message?.id;
      if (stream_handle) stream_handle(e);
    }

    let response = await askChatGPT({
      prompt
    , stream_handle: stream_h
    , conversation_id: this.conversation_id
    , parent_message_id: this.parent_message_id
    , model_name: this.model_name
    , keep_visible: this.keep_visible
    });

    this.conversation_id = response?.data?.conversation_id;
    this.parent_message_id = response?.data?.message?.id;

    return response.answer;
  }

  async end() {
    if (!this.conversation_id) return; //throw new Error('conversation_id required');
    
    return await endChatGPTConversation({
      conversation_id: this.conversation_id
    });
  }
}