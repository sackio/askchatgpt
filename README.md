# AskChatGPT

AskChatGPT is a browser extension that let's users integrate ChatGPT into their browsing. It provides a way to ask ChatGPT questions in the context of a website or selected text.

For web developers, AskChatGPT provides an interface for ChatGPT in the browser. Once a user installs the extension in their browser, a website can use ChatGPT via Javascript, through the user's account.

Think of it like a bridge between your website and ChatGPT, without having to route everything through your OpenAI account.

# Browser API

If a user has the AskChatGPT extension installed, your website can use ChatGPT with a few lines of Javascript.

A client JS file is included in this repo at [here](https://github.com/sackio/askchatgpt/blob/main/dev/client/chatgpt.js)

By including this file on your site, you'll have an easy API for using ChatGPT on your user's behalf:

    //creating a new conversation
    const convo = new ChatGPTConversation();
    
    //now you have a ChatGPT conversation your can interact with
	const answer = await convo.ask('Write a haiku about pickles."); 

It's that simple.

# Web Extension

Have your users install the extension in order to use the Javascript interface:
[Chrome Extension](https://chrome.google.com/webstore/detail/askchatgpt/odbamckofikpepblkpjfnjibflfgbema)
[Firefox Add-On](https://addons.mozilla.org/en-US/firefox/addon/askchatgpt/)

The extension itself provides a good starting point for integrating ChatGPT in your web extension. Feel free to use it as you like.