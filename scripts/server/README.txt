NAILSWAP SERVER SETUP — RICO

What this package does
Installs Docker if needed, starts the official pinned Supabase Docker stack,
adds HTTPS using Caddy, applies NailSwap's database migrations, creates private
photo storage and a sample nail catalog, configures the existing Vercel project,
and deploys the included app using Nano Banana 2 at 1K.

This is for a dedicated Ubuntu 22.04/24.04/26.04 or Debian 12/13 server with sudo,
64-bit x86/ARM, at least 4 GB RAM (8 GB recommended), and 25 GB free disk space.
Ports TCP 80 and 443 must be reachable from the internet and unused on the server.
Outbound HTTPS, Docker Hub, GitHub and Vercel access must work.
Existing websites/reverse proxies on 80/443 require manual integration: this
installer stops instead of replacing them. Do not run it against an existing
NailSwap/Supabase database that was provisioned another way.

RUN
1. Upload NailSwap-Server-Setup.tar.gz to the server using SCP/SFTP.
2. In SSH:

   tar -xzf NailSwap-Server-Setup.tar.gz
   cd NailSwap-Server-Setup
   sudo bash setup.sh

3. Enter your Vercel token when prompted. Create it here:
   https://vercel.com/account/tokens
   It must have access to the khalid-services team and its nailswap project.
   This is the existing project created during setup, not a new Vercel account.
   The installer targets production AND preview environment variables.
4. Press Enter at the fal-key prompt to preserve the existing Vercel key,
   or enter a replacement key. Keys are never included in this package.
5. Enter the server's public IPv4 address. Accept the suggested free hostname
   (nailswap.PUBLIC-IP.sslip.io), or enter a domain already pointing to that IP.

No purchased domain is required for testing. Free shared DNS/certificate rate
limits can prevent issuance; a domain you control is preferable for production.
Your server must remain online for the Vercel app to access its data and photos.

AFTER SETUP
Open https://nailswap.vercel.app/en/try
The browser asks for username tester and a generated password. Read it using:

   sudo cat /opt/nailswap/ACCESS.txt

Select a design and upload a well-lit hand photo. Setup does not generate a paid
image. Images you generate afterward incur fal charges (configured estimate
$0.08 each for Nano Banana 2 at 1K, plus moderation and any provider charges).
The password gate applies to the app and paid-generation API. Internal callbacks
continue to require their separate generated secret.

This package enables anonymous nail-photo testing. SMS/WhatsApp/email, payments,
account signup and salon onboarding are not provisioned. Signup is disabled until
real auth providers are configured. The catalog owner is an inaccessible fixture,
not a platform administrator, and no known demo password or OTP is installed.
Sample photos include attribution in their descriptions and image alt text.

WHERE THINGS LIVE
/opt/nailswap/supabase/docker/.env       Database and Supabase keys (root only)
/opt/nailswap/setup-state.json           Stable generated setup secrets (root only)
/opt/nailswap/ACCESS.txt                 Testing and Studio access (root only)
/opt/nailswap/supabase/docker/volumes    Database files and uploaded photos
/opt/nailswap/releases                  App snapshots used for deployments
Docker named volumes: database config/key, Caddy certificates, other stack data.

Database/pooler ports are not published. Supabase Studio is available only via
an SSH tunnel, not the public backend URL:

   ssh -L 18000:127.0.0.1:18000 YOUR_SSH_USER@YOUR_SERVER_IP

Then open http://localhost:18000 with Studio credentials from ACCESS.txt.
The public backend exposes Auth, REST, Storage and Realtime APIs only.

RETRY / UPDATE
Fix the reported error and run sudo bash setup.sh again from this extracted folder.
The installer preserves database keys and checksums previously applied migrations.
It never resets the database or deletes its volumes. Each successful attempt
redeploys the bundled snapshot. Rebuild the package from the development workspace
to include future source changes. Existing data is not automatically backed up.
Do not delete setup-state.json or .env. Do not use docker compose down -v.

TROUBLESHOOTING
Run these as root (sudo -i), then:

   cd /opt/nailswap/supabase/docker
   docker compose -p nailswap -f nailswap-compose.yml ps
   docker compose -p nailswap -f nailswap-compose.yml logs --tail=80 caddy
   docker compose -p nailswap -f nailswap-compose.yml logs --tail=80 auth storage db

HTTPS failure: check public DNS, port forwarding, cloud firewall, server firewall,
and Caddy logs. Do not expose ports 5432, 6543 or 18000 publicly.
Vercel failure: inspect the deployment build log in Vercel's dashboard and token
permissions. Check the project is still in khalid-services and is named nailswap.
Command failure details are saved, with known secrets redacted, in the root-only
/opt/nailswap/last-error.log. Review locally; do not publish raw logs.
If Vercel Deployment Protection blocks internal cron calls, configure an exception
or disable that protection on this production test domain; the app has its own
testing password gate. The final health check reports a blocked deployment.
Do not publish .env, setup-state.json, ACCESS.txt or raw database/log dumps.

BACKUPS
Before upgrades or accepting real users, configure scheduled, encrypted off-server
backups of PostgreSQL, uploaded files, .env/setup-state.json, and Docker db-config
and Caddy volumes. Test restoring them. Copying live PostgreSQL files alone is not
a consistent backup; use pg_dump/pg_dumpall or a proper PostgreSQL backup tool.
Keep the generated encryption keys together with the data backups.

VALIDATION SCOPE
The package's shell/Python checks, configuration tests, app tests and build are
run in the development workspace. Your remote server, public TLS issuance, Vercel
credentials and final paid image flow can only be verified when you run setup.
The installer performs HTTPS and database/AI-configuration health checks at runtime.

UPSTREAM REFERENCES
https://supabase.com/docs/guides/self-hosting/docker
https://supabase.com/docs/guides/self-hosting/self-hosted-proxy-https
https://docs.docker.com/engine/install/ubuntu/
https://docs.docker.com/engine/install/debian/
https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables

Supabase source pin: self-hosted/v0.8.2
Commit: 564eab8ad7840b13324f68b1bfac074ef8d51c21
