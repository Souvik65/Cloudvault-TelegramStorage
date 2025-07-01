const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');

class TelegramStorageService {
    constructor() {
        this.apiId = parseInt(process.env.TELEGRAM_API_ID);
        this.apiHash = process.env.TELEGRAM_API_HASH;
    }

    async createClient(sessionString) {
        const session = new StringSession(sessionString);
        const client = new TelegramClient(session, this.apiId, this.apiHash, {
            deviceModel: 'CloudVault Server',
            systemVersion: '1.0',
            appVersion: '1.0.0',
            langCode: 'en',
            systemLangCode: 'en',
        });
        await client.connect();
        return client;
    }

    // Method 1: Saved Messages (current method)
    async uploadToSavedMessages(sessionString, file, description) {
        const client = await this.createClient(sessionString);
        try {
            const me = await client.getMe();
            const message = await client.sendFile(me.id, {
                file: file.buffer,
                caption: `📁 ${file.originalname}\n📝 ${description}\n📅 ${new Date().toLocaleString()}`,
                attributes: [
                    new Api.DocumentAttributeFilename({
                        fileName: file.originalname,
                    }),
                ],
                forceDocument: true,
            });
            return {
                messageId: message.id.toString(),
                chatId: me.id.toString(),
                method: 'saved_messages'
            };
        } finally {
            await client.disconnect();
        }
    }

    // Method 2: Private Channel
    async uploadToPrivateChannel(sessionString, file, description, channelId) {
        const client = await this.createClient(sessionString);
        try {
            const message = await client.sendFile(channelId, {
                file: file.buffer,
                caption: `📁 ${file.originalname}\n📝 ${description}\n📅 ${new Date().toLocaleString()}`,
                attributes: [
                    new Api.DocumentAttributeFilename({
                        fileName: file.originalname,
                    }),
                ],
                forceDocument: true,
            });
            return {
                messageId: message.id.toString(),
                chatId: channelId,
                method: 'private_channel'
            };
        } finally {
            await client.disconnect();
        }
    }

    // Method 3: Private Group
    async uploadToPrivateGroup(sessionString, file, description, groupId) {
        const client = await this.createClient(sessionString);
        try {
            const message = await client.sendFile(groupId, {
                file: file.buffer,
                caption: `📁 ${file.originalname}\n📝 ${description}\n📅 ${new Date().toLocaleString()}`,
                attributes: [
                    new Api.DocumentAttributeFilename({
                        fileName: file.originalname,
                    }),
                ],
                forceDocument: true,
            });
            return {
                messageId: message.id.toString(),
                chatId: groupId,
                method: 'private_group'
            };
        } finally {
            await client.disconnect();
        }
    }

    // Method 4: Bot Storage (requires a bot)
    async uploadToBotStorage(sessionString, file, description, botUsername) {
        const client = await this.createClient(sessionString);
        try {
            const bot = await client.getEntity(botUsername);
            const message = await client.sendFile(bot.id, {
                file: file.buffer,
                caption: `📁 ${file.originalname}\n📝 ${description}\n📅 ${new Date().toLocaleString()}`,
                attributes: [
                    new Api.DocumentAttributeFilename({
                        fileName: file.originalname,
                    }),
                ],
                forceDocument: true,
            });
            return {
                messageId: message.id.toString(),
                chatId: bot.id.toString(),
                method: 'bot_storage'
            };
        } finally {
            await client.disconnect();
        }
    }

    // Get user's channels and groups
    async getStorageOptions(sessionString) {
        const client = await this.createClient(sessionString);
        try {
            const dialogs = await client.getDialogs({ limit: 100 });
            
            const options = {
                savedMessages: { id: 'me', name: 'Saved Messages', type: 'saved' },
                channels: [],
                groups: [],
                bots: []
            };

            for (const dialog of dialogs) {
                const entity = dialog.entity;
                
                if (entity.className === 'Channel') {
                    if (entity.megagroup) {
                        // It's a supergroup
                        options.groups.push({
                            id: entity.id.toString(),
                            name: entity.title,
                            type: 'supergroup',
                            canPost: entity.creator || entity.adminRights?.postMessages
                        });
                    } else {
                        // It's a channel
                        options.channels.push({
                            id: entity.id.toString(),
                            name: entity.title,
                            type: 'channel',
                            canPost: entity.creator || entity.adminRights?.postMessages
                        });
                    }
                } else if (entity.className === 'Chat') {
                    // It's a regular group
                    options.groups.push({
                        id: entity.id.toString(),
                        name: entity.title,
                        type: 'group',
                        canPost: !entity.left
                    });
                } else if (entity.className === 'User' && entity.bot) {
                    // It's a bot
                    options.bots.push({
                        id: entity.id.toString(),
                        name: entity.firstName || entity.username,
                        username: entity.username,
                        type: 'bot'
                    });
                }
            }

            return options;
        } finally {
            await client.disconnect();
        }
    }

    // Universal upload method
    async uploadFile(sessionString, file, description, storageConfig = {}) {
        const { method = 'saved_messages', chatId, botUsername } = storageConfig;

        switch (method) {
            case 'saved_messages':
                return await this.uploadToSavedMessages(sessionString, file, description);
            
            case 'private_channel':
                if (!chatId) throw new Error('Channel ID required for private channel storage');
                return await this.uploadToPrivateChannel(sessionString, file, description, chatId);
            
            case 'private_group':
                if (!chatId) throw new Error('Group ID required for private group storage');
                return await this.uploadToPrivateGroup(sessionString, file, description, chatId);
            
            case 'bot_storage':
                if (!botUsername) throw new Error('Bot username required for bot storage');
                return await this.uploadToBotStorage(sessionString, file, description, botUsername);
            
            default:
                return await this.uploadToSavedMessages(sessionString, file, description);
        }
    }

    // Universal download method
    async downloadFile(sessionString, messageId, chatId = null) {
        const client = await this.createClient(sessionString);
        try {
            const targetChat = chatId || 'me';
            const messages = await client.getMessages(targetChat, {
                ids: [parseInt(messageId)],
            });

            if (!messages.length || !messages[0].media) {
                throw new Error('File not found');
            }

            const buffer = await client.downloadMedia(messages[0].media, {});
            return buffer;
        } finally {
            await client.disconnect();
        }
    }

    // Universal delete method
    async deleteFile(sessionString, messageId, chatId = null) {
        const client = await this.createClient(sessionString);
        try {
            if (chatId && chatId !== 'me') {
                // Delete from channel/group
                await client.invoke(
                    new Api.channels.DeleteMessages({
                        channel: chatId,
                        id: [parseInt(messageId)],
                    })
                );
            } else {
                // Delete from saved messages or regular chat
                await client.invoke(
                    new Api.messages.DeleteMessages({
                        id: [parseInt(messageId)],
                    })
                );
            }
            return true;
        } finally {
            await client.disconnect();
        }
    }
}

module.exports = new TelegramStorageService();