/**
 * socket.ts — Socket.io client configuration.
 *
 * autoConnect: false — connect only when an investigation starts.
 * 3 reconnection attempts within ~5 seconds (1666ms delay × 3 = ~5s).
 *
 * Validates: Requirements 11.1, 11.4
 */

import { io } from 'socket.io-client'

const socket = io('http://localhost:3001', {
  autoConnect: false,
  reconnectionAttempts: 3,
  reconnectionDelay: 1666,
  reconnectionDelayMax: 1666,
})

export default socket
