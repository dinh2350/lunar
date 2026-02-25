import { Bot } from 'grammy';
import type { InboundEnvelope } from '../../../shared/src/types.js';
import type { Connector, MessageHandler } from '../types.js';

const MAX_TELEGRAM_LENGTH = 4096;

/**
 * Telegram bot connector using grammY.
 * Normalizes Telegram messages into InboundEnvelope and sends responses back.
 */
export class TelegramConnector implements Connector {
  readonly name = 'telegram';
  private bot: Bot;
  private handler: MessageHandler;

  constructor(token: string, handler: MessageHandler) {
    this.bot = new Bot(token);
    this.handler = handler;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // /start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '🌙 *Lunar AI Agent*\n\nHi! I\'m Lunar, your personal AI assistant.\n\n' +
        'Just send me a message and I\'ll help you out!\n\n' +
        'Commands:\n' +
        '/start — Show this welcome message\n' +
        '/help — Show available features',
        { parse_mode: 'Markdown' },
      );
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '🔧 *What I can do:*\n\n' +
        '• Answer questions using my knowledge base\n' +
        '• Run shell commands\n' +
        '• Read and write files\n' +
        '• Do math calculations\n' +
        '• Remember things you tell me\n\n' +
        'Just type naturally!',
        { parse_mode: 'Markdown' },
      );
    });

    // Handle all text messages
    this.bot.on('message:text', async (ctx) => {
      const chatId = ctx.chat.id.toString();
      const chatType = ctx.chat.type === 'private' ? 'direct' : 'group';

      const envelope: InboundEnvelope = {
        provider: 'telegram',
        peerId: `user:${chatId}`,
        text: ctx.message.text,
        chatType: chatType as 'direct' | 'group',
        ts: new Date(ctx.message.date * 1000).toISOString(),
      };

      // Show typing indicator
      await ctx.replyWithChatAction('typing');

      try {
        const response = await this.handler(envelope);

        // Split long messages at Telegram's 4096 char limit
        const chunks = splitMessage(response, MAX_TELEGRAM_LENGTH);
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      } catch (error: any) {
        console.error(`[telegram] Error handling message:`, error.message);
        await ctx.reply('⚠️ Sorry, something went wrong. Please try again.');
      }
    });
  }

  async start(): Promise<void> {
    console.log('🤖 Telegram bot starting (long polling)...');
    this.bot.start({
      onStart: (botInfo) => {
        console.log(`✅ Telegram bot @${botInfo.username} is running`);
      },
    });
  }

  async stop(): Promise<void> {
    await this.bot.stop();
    console.log('🛑 Telegram bot stopped');
  }
}

/**
 * Split a message into chunks that fit within Telegram's limit.
 * Tries to split at newlines, then at spaces.
 */
function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at last newline within limit
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt <= 0) {
      // Try to split at last space
      splitAt = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitAt <= 0) {
      // Hard split
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}
