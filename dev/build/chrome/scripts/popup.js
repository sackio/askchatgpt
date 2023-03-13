const PROMPTS = {
  'Summarize this': {
    prompt: 'Write a summary of this content'
  }
, 'Explain like I\'m five': {
    prompt: 'Explain this content to me like I\'m a five-year-old.'
  }
, 'Contact info': {
    prompt: 'Find contact info such as email, social media accounts, phone, and address.'
  }
, 'Suggested questions': {
    prompt: 'Write a list of questions I should ask you about the content of this page.'
  }
, 'Tell me about this person': {
    prompt: 'Tell me about this person\'s background and interests.'
  }
, 'Talking points': {
    prompt: 'Write a list of questions or topics I should bring up if I was talking to the person on this page.'
  }
, 'Learn more on Wikipedia': {
    prompt: 'Provide me a list of Wikipedia articles that will help me better understand this content.'
  }
, 'Just the recipe': {
    prompt: 'Write out the ingredients and steps in this recipe, and remove any extra information from the page.'
  }
, 'Instructions only': {
    prompt: 'Write out the instructions as steps, and remove any extra information from the page.'
  }
, 'What\'s the title about?': {
    prompt: 'Explain what the title of this article is referencing.'
  }
, 'Learn this': {
    prompt: 'Learn this material. I\'ll ask you questions about all you\'ve learned later.'
  }
};

const FORMATS = {
  'Text': {
    prompt: 'Format your response as sentences and paragraphs.'
  }
, 'List': {
    prompt: 'Format your response as a list.'
  }
, 'Comma-separated List': {
    prompt: 'Format your response as comma-delimited list.'
  }
, 'Links': {
    prompt: 'Format your response as <a> tags target=_blank.'
  }
};

for (let p in PROMPTS) {
  $('#prompt-templates').append(`<option value="${p}">${p}</option>`);
}

for (let f in FORMATS) {
  $('#format-templates').append(`<option value="${f}">${f}</option>`);
}

async function storeConversation() {
  const data = {
    conversation_id: chatGPTConversation.conversation_id
  , parent_message_id: chatGPTConversation.parent_message_id
  };
  
  await browser.storage.local.set(data);
  return data;
}

async function loadConversation() {
  chatGPTConversation = chatGPTConversation || new ChatGPTConversation({
    keep_visible: true
  });

  const {conversation_id, parent_message_id} = await browser.storage.local.get([
    'conversation_id'
  , 'parent_message_id'
  ]);

  if (conversation_id && parent_message_id) {
    chatGPTConversation.conversation_id = conversation_id;
    chatGPTConversation.parent_message_id = parent_message_id;
  }

  return chatGPTConversation;
}

let last_selection;
async function loadConversationStatus() {
  const is_page_loaded = await isPageLoadedInChatGPT()
    , {conversation_id} = await browser.storage.local.get(['conversation_id']);
  let message = '';

  let selection = await getSelectedText();
  if (selection === last_selection) selection = undefined;

  if (selection) {
    message += 'Selected text will be given to ChatGPT for context.';
  } else {
    if (!is_page_loaded) message += 'By default, the whole page will be sent as context to ChatGPT. ';

    message += 'Select text on the page to give more specific context.';
  }

  if (is_page_loaded) {
    message += ' To have ChatGPT re-learn the whole page, <a href="#" id="new-conversation">start a new conversation</a>';
  } else {
    if (conversation_id) message += ' You\'re in an ongoing conversation. <a href="#" id="new-conversation">Start a new conversation</a>';
  }

  $('#conversation-status').html(message);
}

async function loadLastResponse() {
  const {last_response, last_prompt} = await browser.storage.local.get(['last_response', 'last_prompt']);
  if (last_response) {
    $('#answer').removeClass('d-none').html(last_response);
  }

  if (last_prompt) {
    $('#prompt').val(last_prompt);
    $('#prompt-templates').prepend('<option value=""></option>').val('');
  }
}

async function newConversation() {
  await browser.storage.local.remove([
    'conversation_id'
  , 'parent_message_id'
  , 'last_response'
  , 'last_prompt'
  , 'loaded_pages'
  ]);

  try {
    chatGPTConversation.end();
  } catch (e) {
    
  }

  chatGPTConversation = new ChatGPTConversation({
    keep_visible: true
  });

  await loadConversationStatus();

  $('#answer').addClass('d-none').html('');

  return chatGPTConversation;
}

let chatGPTConversation;
async function promptChatGPT(prompt, stream_handle, save_response=true) {
  await loadConversation();

  const s_h = async res => {
    await storeConversation();
    if (stream_handle) await stream_handle(res);
  }

  let response
  try {
    response = await chatGPTConversation.ask(prompt, stream_handle);
    
    if (save_response) await browser.storage.local.set({
      last_response: response.trim()
    , last_prompt: $('#prompt').val()
    });

    await storeConversation();
  } catch (e) {
    response = `Error: ${e.message}. <a href="https://chat.openai.com" target="_blank">Try re-logging into ChatGPT.</a>`;
    await newConversation();
  }
  return response;
}

async function isPageLoadedInChatGPT() {
  let tab = await getCurrentTab()
    , url = tab.url;

  try {
    let {loaded_pages} = await browser.storage.local.get('loaded_pages');
    loaded_pages = JSON.parse(loaded_pages);
    if (loaded_pages.includes(url)) return true;
  } catch (e) {

  }

  return false;
}

async function savePageAsLoadedInChatGPT() {
  let tab = await getCurrentTab()
    , url = tab.url;

  let pages;
  try {
    const {loaded_pages} = await browser.storage.local.get('loaded_pages');
    pages = JSON.parse(loaded_pages);
  } catch (e) {
    pages = [];
  }
  pages.push(url);

  await browser.storage.local.set({
    loaded_pages: JSON.stringify(pages)
  });
}

async function loadTextIntoChat(content, max_length=8000) {
  if (!content) return;

  let chunks = splitString(content, max_length);

  $('#answer').removeClass('d-none').html(`ChatGPT is learning about your selected text...`);

  if (chunks.length === 1) {
    await promptChatGPT(`I am sending you text content as context. After you receive it just reply with 'OK'. I will then ask you further prompts about this content:\n${content}`, undefined, false);
  } else {
    for (const [i, chk] of chunks.entries()) {
      await promptChatGPT(`I am sending you text content as context. I am breaking my messages into chunks, and this is chunk #${i + 1} of ${chunks.length}. After you receive it just reply with 'OK'. I will then ask you further prompts about all this content:\n${chk}`, undefined, false);
      $('#answer').removeClass('d-none').html(`ChatGPT is learning about your selected text...${Math.round((i + 1) / chunks.length * 100)}% done`);
    }
  }

  await savePageAsLoadedInChatGPT();
}

async function loadPageIntoChat(max_length=8000) {
  let tab = await getCurrentTab()
    , url = tab.url;

  if (await isPageLoadedInChatGPT()) return;

  let html = await getPageHTML()
    , content = textFromHTML(html).replace(/\n+/g, '\n')
    , chunks = splitString(content, max_length);

  $('#answer').removeClass('d-none').html(`ChatGPT is learning about this page...`);

  for (const [i, chk] of chunks.entries()) {
    await promptChatGPT(`I am sending you the text content of a web page at ${url}. I am breaking my messages into chunks, and this is chunk #${i + 1} of ${chunks.length}. After you receive it reply with only 'OK', nothing else. I will then ask you further prompts about all this content:\n${chk}`, undefined, false);
    $('#answer').removeClass('d-none').html(`ChatGPT is learning about this page...${Math.round((i + 1) / chunks.length * 100)}% done`);
  }

  await savePageAsLoadedInChatGPT();
}

async function promptAboutPage(prompt, format, stream_handle) {
  if (format) {
    if (!prompt.match(/\s$/)) prompt += ' ';
    prompt += format;
  }

  let selection = await getSelectedText();
  if (selection === last_selection) selection = undefined;

  if (selection) {
    await loadTextIntoChat(selection);
    last_selection = selection;
  } else await loadPageIntoChat();

  return await promptChatGPT(prompt, stream_handle);
}

async function submitPrompt() {
  let prompt = $('#prompt').val();

  if (!prompt) return;

  let format = getFormat();

  $('#loader').removeClass('d-none');
  $('#ask-chatgpt').attr('disabled', true);

  let answer = await promptAboutPage(prompt, format?.prompt, res => {
    $('#answer').removeClass('d-none').html(res?.answer.trim());
  });

  $('#answer').removeClass('d-none').html(answer?.trim());
  await loadConversationStatus();

  $('#loader').addClass('d-none');
  $('#ask-chatgpt').removeAttr('disabled');
}

function selectPrompt() {
  let prompt = $('#prompt-templates option:selected').val();
  if (!PROMPTS[prompt]) return;

  $('#prompt').val(PROMPTS[prompt].prompt);
}

function getFormat() {
  let format = $('#format-templates option:selected').val();
  if (!FORMATS[format]) return;

  return FORMATS[format];
}

$('#ask-chatgpt').on('click', async e => {
  e.preventDefault();

  submitPrompt();
});

$('#prompt').on('keydown', async e => {
  if (e.keyCode === 13 || e.key === 'Enter') {
    submitPrompt();
    return false;
  }
});

$('#prompt-templates').on('input', e => {
  selectPrompt();
});

$('#conversation-status').on('click', '#new-conversation', async e => {
  e.preventDefault();
  await newConversation();
});

selectPrompt();
loadConversation();
loadConversationStatus();
loadLastResponse();