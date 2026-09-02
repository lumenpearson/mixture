/* request header names shared by the browser transport and the server
   handlers. kept free of server-only imports so both sides can use it. */

/** bearer-style token required for library mutations when MIXTURE_EDIT_TOKEN is set */
export const EDIT_TOKEN_HEADER = "x-mixture-edit-token"

/** a GitHub token the caller brings for the cloud drive (never stored server-side) */
export const CLOUD_TOKEN_HEADER = "x-mixture-cloud-token"

/** a shared access key defined in cloud.config.json (`access.keys`) */
export const CLOUD_KEY_HEADER = "x-mixture-cloud-key"

/** the RPC mount point inside the Next.js app */
export const RPC_BASE_PATH = "/api/rpc"
