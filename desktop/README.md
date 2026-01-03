# upsight-desktop

UpSight desktop meeting recorder - an Electron app that integrates Recall.ai with the UpSight customer intelligence platform.

Built on the [Recall.ai Desktop Recording SDK](https://www.recall.ai/product/desktop-recording-sdk).

See `docs/SPEC.md` for full specification and `docs/PLAN.md` for implementation roadmap.

# Setup

- Copy the `env.example` file to a `.env` file:
    - `cp .env.example .env`

- Replace `RECALLAI_API_URL` with the base URL for the [Recall region](https://docs.recall.ai/docs/regions#/) that you're using that matches your API key, example:
    - `RECALLAI_API_URL=https://us-east-1.recall.ai`

- Modify `.env` to include your Recall.ai API key:
    - `RECALLAI_API_KEY=<your key>`

This project also tries to use live transcription with Deepgram by default. To enable this, you'll need to configure your own Deepgram credentials on the Recall.ai dashboard. Follow our [Deepgram real-time transcription guide](https://docs.recall.ai/docs/dsdk-realtime-transcription#/deepgram-transcription-setup) to set this up.

If you want to enable the AI summary after a recording is finished, you can specify an OpenRouter API key.

```
OPENROUTER_KEY=<your key>
```

To launch the application:

```sh
npm ci
npm start
```

# Screenshots

![Screenshot 2025-06-16 at 10 10 57 PM](https://github.com/user-attachments/assets/9df12246-b5be-466d-958e-e09ff0b4b3cb)
![Screenshot 2025-06-16 at 10 22 44 PM](https://github.com/user-attachments/assets/685f13ab-7c02-4f29-a987-830d331c4d36)
![Screenshot 2025-06-16 at 10 14 38 PM](https://github.com/user-attachments/assets/75817823-084c-46b0-bbe8-e0195a3f9051)
