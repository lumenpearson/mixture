/** largest RPC message the server reads (also the cloud upload cap; Vercel
 *  functions accept about 4.5 MB per request body) */
export const RPC_MAX_MESSAGE_BYTES = 4 * 1024 * 1024
