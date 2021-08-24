const core = require('@actions/core');
const github = require('@actions/github');
const { WebClient } = require('@slack/web-api');
const { buildSlackAttachments, formatChannelName } = require('./src/utils');

(async () => {
  try {
    const channel = core.getInput('channel');
    const status = core.getInput('status');
    const color = core.getInput('color');
    const messageId = core.getInput('message_id');
    const text = core.getInput('text');
    const token = process.env.SLACK_BOT_TOKEN;
    const slack = new WebClient(token);

    if (!channel && !core.getInput('channel_id')) {
      core.setFailed(`You must provider either a 'channel' or a 'channel_id'.`);
      return;
    }

    // if messageId is used (update), then try to get the actual data, like color and status
    if (Boolean(messageId)) {
      const result = await slack.client.conversations.history({
        token: token,
        channel: channel,
        latest: messageId,
        // Limit results
        inclusive: true,
        limit: 1
      });

      if (!Boolean(color)) color = result.messages[0].attachments.color;
      if (!Boolean(status)) status = result.messages[0].attachments.status;
    }

    const attachments = buildSlackAttachments({ status, color, github, text });
    const channelId = core.getInput('channel_id') || (await lookUpChannelId({ slack, channel }));

    if (!channelId) {
      core.setFailed(`Slack channel ${channel} could not be found.`);
      return;
    }

    const apiMethod = Boolean(messageId) ? 'update' : 'postMessage';

    const args = {
      channel: channelId,
      attachments,
    };

    if (messageId) {
      args.ts = messageId;
    }

    const response = await slack.chat[apiMethod](args);

    core.setOutput('message_id', response.ts);
  } catch (error) {
    core.setFailed(error);
  }
})();

async function lookUpChannelId({ slack, channel }) {
  let result;
  const formattedChannel = formatChannelName(channel);

  // Async iteration is similar to a simple for loop.
  // Use only the first two parameters to get an async iterator.
  for await (const page of slack.paginate('conversations.list', { types: 'public_channel, private_channel' })) {
    // You can inspect each page, find your result, and stop the loop with a `break` statement
    const match = page.channels.find(c => c.name === formattedChannel);
    if (match) {
      result = match.id;
      break;
    }
  }

  return result;
}

// Fetch conversation history using the ID and a TS
async function fetchMessage(channel_id, message_ts) {
  try {
    // Call the conversations.history method using the built-in WebClient
    const result = await app.client.conversations.history({
      // The token you used to initialize your app
      token: token,
      channel: channel_id,
      // In a more realistic app, you may store ts data in a db
      latest: message_ts,
      // Limit results
      inclusive: true,
      limit: 1
    });

    // There should only be one result (stored in the zeroth index)
    message = result.messages[0];
    // Print message text
    console.log(message.text);
  }
  catch (error) {
    console.error(error);
  }
}
