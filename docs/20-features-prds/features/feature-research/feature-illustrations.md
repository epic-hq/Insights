# Feature Illustrations

## Need

Illustrations that augment the persona definitions.

## Implementation

Version one  here:

supabase/functions/illustrate


Direct API call to openAI.

```bash
curl https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "Flat illustration of a student at a desk, vector style",
    "size": "1024x1024",
    "n": 1,
    "background": "transparent",
    "response_format": "b64_json"
  }' \
| jq -r '.data[0].b64_json' | base64 --decode > output.png
```

## Resources

https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1