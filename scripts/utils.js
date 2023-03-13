async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true};
  let [tab] = await browser.tabs.query(queryOptions);
  return tab;
}

function splitString(str, len) {
  const chunks = [];
  let i = 0;
  while (i < str.length) {
    chunks.push(str.substr(i, len));
    i += len;
  }
  return chunks;
}

async function wait(ms) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

async function getPageHTML() {
  let tab = await getCurrentTab()
    , res = await browser.scripting.executeScript({
        target: {tabId: tab.id},
        func: () => document.querySelector('html').innerHTML
      });

  return res?.[0]?.result;
}

async function getSelectedText() {
  const {id} = await getCurrentTab();
  
  const res = await browser.scripting.executeScript({
    target: {tabId: id}
  , func: () => {
      return window.getSelection().toString();
    }
  });

  return res?.[0]?.result;
}

function textFromHTML(htmlString) {
  // Remove script and style tags and their contents
  let text = htmlString.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove all HTML tags except href attribute values
  text = text.replace(/<[^>]*>/gi, (match) => {
    if (match.includes('href=')) {
      // If the tag contains an href attribute, return the href value
      const hrefValue = match.match(/href=["']?([^"']*)["']?/i)[1];
      return hrefValue;
    } else {
      // If the tag doesn't contain an href attribute, return an empty string
      return '';
    }
  });

  // Remove any leading/trailing white space
  text = text.trim();
  text = text.replace(/\s+/g, ' ');

  return text;
}

function relevantHTML(htmlString) {
  // Remove script and style tags and their contents
  let text = htmlString.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove any leading/trailing white space
  text = text.trim();
  text = text.replace(/\s+/g, ' ');

  return text;
}