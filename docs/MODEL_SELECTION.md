# OpenAI Model Selection Guide

Easily swap between different OpenAI models to optimize for cost, performance, or accuracy.

## Quick Start

Change the model in your `.env` file:

```env
# Default (recommended)
OPENAI_MODEL=gpt-4o-mini

# For better accuracy
OPENAI_MODEL=gpt-4o

# For even lower cost
OPENAI_MODEL=gpt-3.5-turbo
```

That's it! Restart the app and it will use the new model.

## Available Models

### 🏆 GPT-4o-mini (Recommended)

**Best for**: Most users, production use

```env
OPENAI_MODEL=gpt-4o-mini
```

**Pros**:

- ⚡ Very fast (500-1500ms)
- 💰 Extremely cheap ($0.150/$0.600 per 1M tokens)
- 🎯 Excellent accuracy for structured tasks
- ✅ Perfect for name extraction and summarization

**Cons**:

- Slightly less capable than GPT-4o for complex reasoning

**Costs** (per operation):

- Name extraction: ~$0.0003
- Conversation summary: ~$0.001
- **Daily (10 convos)**: ~$0.015

**When to use**:

- ✅ Default choice for most users
- ✅ Production deployments
- ✅ Budget-conscious development
- ✅ High-volume usage

---

### 🚀 GPT-4o

**Best for**: Maximum accuracy, complex conversations

```env
OPENAI_MODEL=gpt-4o
```

**Pros**:

- 🧠 Most capable model
- 🎯 Best accuracy for complex names
- 📝 Superior summarization quality
- 🌍 Better multilingual support

**Cons**:

- 💸 More expensive (15x cost of gpt-4o-mini)
- ⏱️ Slightly slower

**Costs** (per operation):

- Name extraction: ~$0.005
- Conversation summary: ~$0.015
- **Daily (10 convos)**: ~$0.20

**When to use**:

- ✅ Need maximum accuracy
- ✅ Complex/unusual names
- ✅ Multilingual conversations
- ✅ Premium experience
- ✅ Cost is not a concern

---

### 💎 GPT-4-turbo

**Best for**: Balance between GPT-4o and GPT-4o-mini

```env
OPENAI_MODEL=gpt-4-turbo
```

**Pros**:

- 🎯 Very good accuracy
- ⚡ Fast performance
- 📊 Large context window (128K tokens)

**Cons**:

- 💰 More expensive than gpt-4o-mini
- 🔄 Being phased out in favor of GPT-4o

**Costs** (per operation):

- Name extraction: ~$0.002
- Conversation summary: ~$0.006
- **Daily (10 convos)**: ~$0.08

**When to use**:

- ✅ Need better accuracy than gpt-4o-mini
- ✅ Working with large conversation transcripts
- ✅ Want faster than GPT-4o but better than gpt-4o-mini

---

### 💵 GPT-3.5-turbo

**Best for**: Extreme budget constraints

```env
OPENAI_MODEL=gpt-3.5-turbo
```

**Pros**:

- 💰 Cheapest option ($0.50/$1.50 per 1M tokens)
- ⚡ Fast responses
- ✅ Still capable for basic tasks

**Cons**:

- 📉 Lower accuracy than GPT-4 models
- ⚠️ May miss some names or contexts
- 🔄 Being phased out

**Costs** (per operation):

- Name extraction: ~$0.0001
- Conversation summary: ~$0.0003
- **Daily (10 convos)**: ~$0.004

**When to use**:

- ✅ Testing/development only
- ✅ Extreme budget constraints
- ✅ Simple, straightforward names only
- ⚠️ Not recommended for production

---

## Cost Comparison

### Per Name Extraction (~200 tokens in, ~100 tokens out)

| Model | Input Cost | Output Cost | Total per Operation |
|-------|------------|-------------|---------------------|
| gpt-4o-mini | $0.00003 | $0.00006 | **$0.0003** ⭐ |
| gpt-3.5-turbo | $0.00010 | $0.00015 | $0.0001 |
| gpt-4-turbo | $0.00200 | $0.00300 | $0.002 |
| gpt-4o | $0.00500 | $0.01500 | $0.005 |

### Per Conversation Summary (~500 tokens in, ~200 tokens out)

| Model | Input Cost | Output Cost | Total per Operation |
|-------|------------|-------------|---------------------|
| gpt-4o-mini | $0.00008 | $0.00012 | **$0.001** ⭐ |
| gpt-3.5-turbo | $0.00025 | $0.00030 | $0.0003 |
| gpt-4-turbo | $0.00500 | $0.00600 | $0.006 |
| gpt-4o | $0.01250 | $0.03000 | $0.015 |

### Daily Cost (10 conversations, 5 min each)

| Model | Name Extraction | Summaries | Total/Day | Total/Month |
|-------|----------------|-----------|-----------|-------------|
| gpt-4o-mini | $0.003 | $0.010 | **$0.015** | **$0.45** ⭐ |
| gpt-3.5-turbo | $0.001 | $0.003 | $0.004 | $0.12 |
| gpt-4-turbo | $0.020 | $0.060 | $0.080 | $2.40 |
| gpt-4o | $0.050 | $0.150 | $0.200 | $6.00 |

---

## Performance Comparison

### Response Latency (average)

| Model | Name Extraction | Summarization | Total Latency |
|-------|----------------|---------------|---------------|
| gpt-4o-mini | 500-1500ms ⚡ | 800-2000ms | ~1200ms avg |
| gpt-3.5-turbo | 400-1000ms | 600-1500ms | ~900ms avg |
| gpt-4-turbo | 1000-2500ms | 1500-3000ms | ~2000ms avg |
| gpt-4o | 1500-3000ms | 2000-4000ms | ~2500ms avg |

### Accuracy (subjective ratings)

| Model | Name Extraction | Summarization | Overall |
|-------|----------------|---------------|---------|
| gpt-4o | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Excellent |
| gpt-4o-mini | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Very Good ⭐ |
| gpt-4-turbo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Very Good |
| gpt-3.5-turbo | ⭐⭐⭐ | ⭐⭐⭐ | Good |

---

## Recommendation Matrix

### Choose GPT-4o-mini if

- ✅ You want the best balance of cost/performance
- ✅ Handling typical English names
- ✅ Running in production
- ✅ Processing high volume
- ✅ Budget matters

### Choose GPT-4o if

- ✅ Need maximum accuracy
- ✅ Complex or unusual names (e.g., "Siobhan", "Xiuying")
- ✅ Multilingual conversations
- ✅ Premium service offering
- ✅ Cost is secondary to quality

### Choose GPT-4-turbo if

- ✅ Need very long context (rare for this use case)
- ✅ Want better than mini, but cheaper than 4o
- ✅ Already familiar with this model

### Choose GPT-3.5-turbo if

- ✅ Testing only
- ✅ Extremely budget-constrained
- ⚠️ Accept lower accuracy

---

## How to Switch Models

### Method 1: Environment Variable (Recommended)

1. Edit `.env`:

   ```env
   OPENAI_MODEL=gpt-4o
   ```

2. Restart the app:

   ```bash
   npm run dev
   ```

3. Check the console:

   ```md
   - Name Extraction (OpenAI gpt-4o)
   ```

### Method 2: Hardcode in Service (Not Recommended)

Edit `src/services/nameExtractionService.ts`:

```typescript
constructor(apiKey: string, model: string = 'gpt-4o') {
  // ...
}
```

---

## Testing Different Models

Create a test script to compare models:

```bash
# Test with gpt-4o-mini
OPENAI_MODEL=gpt-4o-mini npm run dev

# In another session, test with gpt-4o
OPENAI_MODEL=gpt-4o npm run dev
```

Compare:

- Response time (check console logs)
- Accuracy (test with complex names)
- Cost (check OpenAI dashboard)

---

## Advanced Configuration

### Different Models for Different Tasks

Want to use gpt-4o-mini for name extraction but GPT-4o for summaries?

Edit `src/services/nameExtractionService.ts`:

```typescript
export class NameExtractionService {
  private client: OpenAI;
  private extractionModel: string;
  private summaryModel: string;

  constructor(apiKey: string, extractionModel: string = 'gpt-4o-mini', summaryModel: string = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey });
    this.extractionModel = extractionModel;
    this.summaryModel = summaryModel;
  }

  async extractNames(transcript: string) {
    const response = await this.client.chat.completions.create({
      model: this.extractionModel, // Use extraction model
      // ...
    });
  }

  async summarizeConversation(transcript: string) {
    const response = await this.client.chat.completions.create({
      model: this.summaryModel, // Use summary model
      // ...
    });
  }
}
```

Then in `.env`:

```env
OPENAI_EXTRACTION_MODEL=gpt-4o-mini
OPENAI_SUMMARY_MODEL=gpt-4o
```

---

## Model Updates

OpenAI regularly updates models. To use the latest:

### Snapshot Models

Use specific snapshots for reproducibility:

```env
# Use specific GPT-4o snapshot
OPENAI_MODEL=gpt-4o-2024-08-06

# Use specific GPT-4o-mini snapshot
OPENAI_MODEL=gpt-4o-mini-2024-07-18
```

### Always Latest

Use dynamic model names:

```env
# Always use latest GPT-4o
OPENAI_MODEL=gpt-4o

# Always use latest GPT-4o-mini
OPENAI_MODEL=gpt-4o-mini
```

Check [OpenAI Models](https://platform.openai.com/docs/models) for latest versions.

---

## Monitoring & Optimization

### Track Model Performance

Add logging to measure:

```typescript
const startTime = Date.now();
const names = await this.nameExtractor.extractNames(transcript);
const latency = Date.now() - startTime;
console.log(`Model: ${OPENAI_MODEL}, Latency: ${latency}ms, Names found: ${names.length}`);
```

### Cost Tracking

Monitor on OpenAI dashboard:

1. Go to [platform.openai.com/usage](https://platform.openai.com/usage)
2. Filter by model
3. Analyze costs per day/month

### A/B Testing

Run two instances:

- Instance A: gpt-4o-mini
- Instance B: gpt-4o

Compare accuracy and user satisfaction.

---

## Troubleshooting

### Model Not Found Error

```md
Error: The model `gpt-4o` does not exist
```

**Solutions**:

1. Check spelling in `.env`
2. Verify model is available in your region
3. Ensure your OpenAI account has access
4. Use a model snapshot: `gpt-4o-2024-08-06`

### Slow Performance

If responses are too slow:

1. Switch to gpt-4o-mini (fastest)
2. Reduce `max_tokens`
3. Check internet connection
4. Verify OpenAI status

### High Costs

If costs are too high:

1. Switch to gpt-4o-mini (cheapest effective option)
2. Increase `PROCESS_INTERVAL` (batch more transcriptions)
3. Cache repeated names locally
4. Consider gpt-3.5-turbo for testing

---

## FAQ

**Q: Which model should I use?**
A: Start with `gpt-4o-mini`. It's fast, cheap, and accurate for this use case.

**Q: Can I use different OpenAI accounts?**
A: Yes, just change `OPENAI_API_KEY` in `.env`.

**Q: Will future models work?**
A: Yes! As long as they support chat completions API.

**Q: Can I use non-OpenAI models?**
A: Not directly. You'd need to rewrite `nameExtractionService.ts` for other providers (Anthropic, Google, etc.).

**Q: What about GPT-4?**
A: GPT-4 is deprecated. Use `gpt-4-turbo` or `gpt-4o` instead.

**Q: How much does GPT-4o cost vs gpt-4o-mini?**
A: GPT-4o costs about 15-20x more than gpt-4o-mini.

---

## Summary

**For most users**: Stick with **gpt-4o-mini** ⭐

It offers the best balance of:

- ⚡ Speed
- 💰 Cost
- 🎯 Accuracy

Only switch to GPT-4o if you need maximum accuracy and cost isn't a concern.

---

## Quick Reference

```env
# Recommended (default)
OPENAI_MODEL=gpt-4o-mini

# Premium (best accuracy)
OPENAI_MODEL=gpt-4o

# Budget (testing only)
OPENAI_MODEL=gpt-3.5-turbo

# Balanced (alternative)
OPENAI_MODEL=gpt-4-turbo
```

**Need help?** Check the console on startup:

```
- Name Extraction (OpenAI gpt-4o-mini)
```

That's the model you're using! 🚀
