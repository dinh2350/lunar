/**
 * Message in a conversation.
 * Every message has a role (who's speaking) and content (what they said).
 *
 * role: 'system'    → developer instructions (hidden from user)
 * role: 'user'      → what the human typed
 * role: 'assistant' → what the AI said
 * role: 'tool'      → tool execution results (Week 2)
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}
