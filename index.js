const core = require('@actions/core');
const github = require('@actions/github');
const { WebClient } = require('@slack/web-api');
const { buildSlackAttachments, formatChannelName } = require('./src/utils');

const warning = 'daa038';
const good = '2eb886';
const danger = 'a30200';

(async () => {
  try {
    const channel = core.getInput('channel');
    let status = core.getInput('status');
    let color = core.getInput('color');
    const messageId = core.getInput('message_id');
    const text = core.getInput('text');
    const token = process.env.SLACK_BOT_TOKEN;
    const slack = new WebClient(token);

    if (!channel && !core.getInput('channel_id')) {
      core.setFailed(`You must provider either a 'channel' or a 'channel_id'.`);
      return;
    }

    const channelId = core.getInput('channel_id') || (await lookUpChannelId({ slack, channel }));

    // if messageId is used (update), then try to get the actual data, like color and status
    if (Boolean(messageId)) {
      const result = await slack.conversations.history({
        token: token,
        channel: channelId,
        latest: messageId,
        inclusive: true,
        limit: 1
      });
      console.log(result.messages[0].attachments[0]);
      console.log(result.messages[0].attachments[0].fields[0]);
      console.log(result.messages[0].attachments[0].fields[0].status);
      if (!Boolean(color)) color = result.messages[0].attachments[0].color;
      if (!Boolean(status)) status = result.messages[0].attachments[0].fields[0].status;
      // {
      //   if (color == good) status = 'SUCCESS';
      //   else if (color == danger) status = 'FAILED';
      //   else if (color == warning) status = 'STARTING';
      //   else status = 'UNKNOWN';
      // }
    }

    const attachments = buildSlackAttachments({ status, color, github, text });

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
