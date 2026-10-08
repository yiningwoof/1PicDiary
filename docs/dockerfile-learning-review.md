# Production Dockerfile: Questions and Learnings

## What are Dockerfile, image, and container?

- **Dockerfile:** instructions for building an image.
- **Image:** immutable package containing the app and its runtime.
- **Container:** a running instance of that image.

`docker build` creates an image. `docker run` starts a container.

## What does a Node.js environment mean?

It is an operating environment with the Node.js executable and APIs needed to run server-side JavaScript. A normal Node environment can use the filesystem, networking, npm packages, and native binaries.

Cloud Run supplies a normal Linux container. Cloudflare Workers use a web/edge runtime with Node compatibility, but it is not the same as an unrestricted Node process.

## Why is Cloud Run a good fit for Sharp?

Sharp is a Node package backed by the native **libvips** image library. Native code must match the operating system and CPU architecture.

Cloud Run runs a normal Linux container, so Sharp installs and executes its Linux binary normally. The app can also receive more memory a,nd CPU for large phone photos.

## What does Next.js `standalone` mean?

`output: "standalone"` tells Next.js to trace which files the production server actually needs and copy them into `.next/standalone`.

The result contains `server.js` and a reduced set of runtime dependencies. It does not mean the app has no dependencies; it means the deployable server bundle is self-contained.

The Docker image must also copy `.next/static`. If the project gains a `public` directory, copy that too.

## Why does standalone make the image smaller?

The final image receives only:

- The standalone server
- Traced runtime dependencies
- Compiled static assets

It leaves behind source files, tests, build tools, caches, and unrelated dependencies.

## Why is startup faster?

Cloud Run starts the already-built `server.js`. It does not install packages or compile Next.js during startup. A smaller image can also be transferred and unpacked more quickly.

## Why are Node and Sharp versions predictable?

`FROM node:22.23.2-bookworm-slim` pins Node and the Debian base. `npm ci` installs the versions in `package-lock.json`. Sharp is installed inside Linux, so Docker packages the matching Linux native binary.

Without pinning, a future base-image or dependency update could change runtime behavior.

## Why use the same image locally and in Cloud Run?

Local macOS and Cloud Run Linux differ. Running the production image locally tests the actual Linux runtime, Node version, startup command, port, and Sharp binary that Cloud Run will use.

Environment variables can differ while the image remains identical.

## Why are there three `FROM` stages?

| Stage | Work | Included in final image? |
|---|---|---|
| `dependencies` | Runs `npm ci` | No |
| `builder` | Runs `next build` | No |
| `runner` | Runs `server.js` | Yes |

These are build stages, not three production containers. Only `runner` becomes the deployed image.

## Why copy `package.json` explicitly?

Docker cannot automatically see project files. `COPY package.json package-lock.json ./` makes the dependency definitions available as `/app/package.json` and `/app/package-lock.json`, where `npm ci` can read them.

They are copied before the source to improve caching. Docker builds instructions as ordered layers. When one layer's input changes, that layer and the layers after it must rebuild.

```text
Package files unchanged → reuse npm ci layer
Application changed     → copy source and rebuild Next.js

Package files changed   → rerun npm ci and rebuild Next.js
```

With `COPY . .` before `npm ci`, editing one page would change the copy layer and force Docker to reinstall every dependency. Put stable inputs early and frequently changed source later.

## Why use `npm ci` instead of `npm install`?

`npm ci` performs a clean, repeatable install from `package-lock.json` and fails when the manifest and lockfile disagree. That is better for automated builds.

`ci` means **continuous integration**. Use `npm install <package>` while developing because it updates the package files. Use `npm ci` in Docker because it:

- Removes the existing `node_modules` first.
- Installs the exact locked dependency tree.
- Does not modify the lockfile.
- Fails when `package.json` and the lockfile disagree.

It installs development dependencies too, because the builder needs them. The final stage copies only standalone runtime files, so build-only packages stay out of the production image.

## What does a repeatable installation mean?

Running the install at different times or on different machines yields the same package versions and dependency tree. A version range in `package.json` may allow several releases; `package-lock.json` records the exact selected versions.

The package versions remain consistent across the Mac, Docker, Cloud Build, and CI. Platform-specific files still differ appropriately: Sharp installs a macOS binary on the Mac and a Linux binary in Docker.

## What do the main Dockerfile instructions mean?

- `FROM`: choose a base image or start a new stage.
- `WORKDIR /app`: make `/app` the current directory inside the image.
- `COPY`: copy files from the build context or another stage.
- `RUN`: execute a command while building the image.
- `ENV`: define runtime defaults.
- `USER nextjs`: run the app without root privileges.
- `EXPOSE 8080`: document the container port; it does not publish it.
- `CMD ["node", "server.js"]`: command executed when the container starts.

## What does `COPY . .` mean?

Copy the current build context on the Mac into the current container directory. `.dockerignore` removes files that should not enter that context, including `.env.local`, `.git`, local `node_modules`, and `.next`.

## Why create a Linux user and group?

A container process needs a Linux identity. Without `USER nextjs`, it commonly runs as `root`, which has the broadest permissions inside the container.

- `nodejs` is the service group with group ID `1001`.
- `nextjs` is the service user with user ID `1001`.
- `--system` marks them as service accounts rather than human accounts.
- `--chown=nextjs:nodejs` gives them ownership of the copied app.
- `USER nextjs` starts the server as that restricted user.

The group provides a standard ownership and shared-permission boundary, even though this app currently has one service user. This follows least privilege: the server needs to read the app, listen on port 8080, and make outbound requests; it does not need root access.

## Why `HOSTNAME=0.0.0.0` and `PORT=8080`?

- `0.0.0.0` accepts traffic from outside the container.
- `localhost` would accept only traffic originating inside it.
- Cloud Run supplies `PORT`; `8080` is the image's local default.

`EXPOSE 8080` is documentation. Local `-p 8080:8080` performs the actual Mac-to-container port mapping.

## Where do environment variables and secrets go?

They are runtime configuration, not image contents.

- Local: inject `.env.local` with `--env-file`.
- Cloud Run: use environment variables and Secret Manager.
- Never copy or bake secrets into the image.
- Never prefix a server secret with `NEXT_PUBLIC_`; Next.js may include those values in browser JavaScript.

## What is the browser?

The browser is the user's Chrome, Safari, or other web client. It displays the interface and runs downloaded client-side JavaScript. Users can inspect anything sent to it, so browser code cannot safely hold server secrets.

## What is the server?

The server is the Next.js process running `server.js` inside the Cloud Run container. It receives HTTP requests, executes API routes, reads private environment variables, calls Supabase and Google APIs, processes images with Sharp, and sends responses.

```text
Phone browser → HTTPS → Cloud Run → Next.js server
```

## Is Next.js the browser or the server?

It can produce both:

- **Client code** runs in the browser and handles interaction.
- **Server code** runs inside Cloud Run and handles trusted work.

`"use client"` marks a component that can run in the browser. Route handlers under `app/api/.../route.ts` run on the server.

## What is an API?

An API is a defined way for software to communicate. The browser calls the 1PicDiary API; the 1PicDiary server then calls the Supabase and Google Photos APIs.

```text
Browser
   ↓ 1PicDiary API
Next.js server
   ├─→ Supabase API
   └─→ Google Photos API
```

## What is an API route?

An API route is a server URL backed by code. For example:

```text
app/api/subjects/route.ts → /api/subjects
```

The exported function matches the HTTP method:

```ts
export async function GET()  // read data
export async function POST() // submit or create data
```

A page route returns user interface content. An API route usually returns data, often JSON, or performs an operation.

## What are request and response?

- **Request:** what the browser sends, including URL, method, headers, cookies, and optional body.
- **Response:** what the server returns, including status code, headers, and data.

Example:

```text
GET /api/subjects
→ 200 OK + subject data
```

## Why use server API routes instead of calling Supabase directly from the browser?

The current design keeps `SUPABASE_SECRET_KEY` on the server. A route authenticates the user, decides what they may access, then performs the database operation with the privileged key.

```text
Browser → trusted Next.js route → Supabase
```

If the browser connected with the secret key, every user could extract it. A browser-facing Supabase design would instead need a publishable key plus correctly configured Row Level Security.

## What does `NEXT_PUBLIC_` mean?

Next.js may embed variables with this prefix into downloaded browser JavaScript. They must be safe for anyone to inspect.

| Variable | Location |
|---|---|
| `NEXT_PUBLIC_*` | Browser and server |
| `SUPABASE_URL` | Server in the current design |
| `SUPABASE_SECRET_KEY` | Server only |
| `GOOGLE_CLIENT_SECRET` | Server only |

## How does a request reach an API route in Docker?

```text
Browser requests /api/save-diary
→ Cloud Run accepts HTTPS
→ forwards to container port $PORT
→ Next.js matches app/api/save-diary/route.ts
→ route runs Sharp/Google/Supabase work
→ response returns to browser
```

Docker packages the server; it does not change the application's routes. The same paths work locally and on Cloud Run—the hostname changes.

## Does Cloudflare support Sharp?

Cloudflare Containers can run normal Node and native Sharp binaries. A Worker alone uses a constrained edge runtime and is not a direct replacement for this Sharp pipeline. Using Workers plus Containers adds a routing boundary that the MVP does not currently need.

Cloud Run was chosen because the entire Next.js and Sharp app can run as one conventional container. A later Cloudflare migration remains feasible.

## Build and run

```bash
docker build -t 1picdiary .
docker run --rm --env-file .env.local -p 8080:8080 1picdiary
```

- `-t 1picdiary`: name/tag the image.
- `--rm`: delete the container after it stops.
- `--env-file`: inject runtime variables.
- `-p 8080:8080`: map Mac port 8080 to container port 8080.

Open `http://localhost:8080`.

## What did we verify?

- Next.js production and standalone builds succeed.
- Sharp creates a PNG inside the Linux image.
- The server listens on `0.0.0.0:8080`.
- The container runs as the non-root `nextjs` user.
