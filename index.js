const core = require('@actions/core');
const github = require('@actions/github');
const { WebClient } = require('@slack/web-api');
const { buildSlackAttachments, formatChannelName } = require('./src/utils');

(async () => {
  try {
    const channel = core.getInput('channel');
    const messageId = core.getInput('message_id');
    const text = core.getInput('text');
    const token = process.env.SLACK_BOT_TOKEN;
    const slack = new WebClient(token);
    let status = core.getInput('status');
    let color = core.getInput('color');

    if (!channel && !core.getInput('channel_id')) {
      core.setFailed(`You must provider either a 'channel' or a 'channel_id'.`);
      return;
    }

    const channelId = core.getInput('channel_id') || (await lookUpChannelId({ slack, channel }));
    if (!channelId) {
      core.setFailed(`Slack channel ${channel} could not be found.`);
      return;
    }

    if (!messageId && !status) {
      core.setFailed(`You must provide an status when creating a new message`);
      return;
    }

    if (status && !color) color = getStatusColor(status);

    // if messageId is used (update), keep the same color and status if not modified
    if (!messageId) {
      const messageData = getMessage(slack, token, channelId, messageId);
      if (!color) color = messageData.attachments[0].color;
      if (!status) status = messageData.attachments[0].fields[2].value;
    }

    const attachments = buildSlackAttachments({ status, color, github, text });
    const args = {
      channel: channelId,
      attachments,
    };

    if (messageId) {
      args.ts = messageId;
    }

    const apiMethod = Boolean(messageId) ? 'update' : 'postMessage';
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

async function getMessage({ slack, token, channelId, messageId }) {
  let result = await slack.conversations.history({
    token: token,
    channel: channelId,
    latest: messageId,
    inclusive: true,
    limit: 1
  });

  return result.messages[0];
}

function getStatusColor(status) {
  let color;
  if (status === 'SUCCESS') color = 'good'
  else if (status === 'STARTING') color = 'warning'
  else if (status === 'FAILURE') color = 'danger'
  else color = '#cccccc';

  return color;
}
