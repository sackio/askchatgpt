[
  'chatgpt:prompt'
, 'chatgpt:conversation:end'
].forEach(event_name => {
  document.addEventListener(event_name, data => {
    browser.runtime.sendMessage({
      message: event_name
    , data: data.detail
    });
  });
});

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  let msg = request.message || '';
  if (msg.match(/^chatgpt/)) {
    let event = new CustomEvent(msg, {detail: request.data});
    document.dispatchEvent(event);
  }
});