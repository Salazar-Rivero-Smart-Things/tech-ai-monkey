import { eveChannel } from "eve/channels/eve";
import { jwtHmac, localDev } from "eve/channels/auth";
import { AGENT_AUDIENCE, AGENT_ISSUER } from "../lib/jwt";

// The default /eve/v1/* HTTP API, protected by the agent's own API keys.
// - Production: requests must send `Authorization: Bearer <key>` (a JWT minted
//   by the issue_api_key tool, signed with AGENT_API_KEY_SECRET).
// - Local dev (`eve dev`): `localDev()` accepts requests without a key so the
//   terminal UI and the bundled web chat work out of the box.
const secret = process.env.AGENT_API_KEY_SECRET;

export default eveChannel({
  auth: secret
    ? [
        jwtHmac({
          algorithm: "HS256",
          secret,
          issuer: AGENT_ISSUER,
          audiences: [AGENT_AUDIENCE],
        }),
        localDev(),
      ]
    : [localDev()],
});
