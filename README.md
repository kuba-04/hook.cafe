# Mezzely

//todo

## Running locally

### a) dev mode
It is recommended to test with locally running relay. Then create `.env` file with relay url:
```
PUBLIC_RELAY_URL=ws://127.0.0.1:8080
```
Once you've installed dependencies with `npm install`, start dev server:
```bash
npm run dev
```
### b) docker
If you don't want to make any changes you can just build the app and run in docker:
```bash
docker build -t mezzely .
docker run --name mezzely -p 3000:3000 mezzely

# or you can pass relay URL:
docker run --name mezzely -e PUBLIC_RELAY_URL=wss://your-nostr-relay.com -p 3000:3000 mezzely
```