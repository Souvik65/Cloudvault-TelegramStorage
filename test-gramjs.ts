import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';

async function test() {
  const client = new TelegramClient(new StringSession(''), 123, 'hash', {});
  console.log(client.downloadMedia.toString());
}
test();
