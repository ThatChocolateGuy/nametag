# Model Configuration Feature - Summary

## ✅ What's New

You can now easily swap OpenAI models with a single environment variable!

## Quick Usage

### Change Model in .env

```env
# Default (recommended)
OPENAI_MODEL=gpt-4o-mini

# For maximum accuracy
OPENAI_MODEL=gpt-4o

# For budget testing
OPENAI_MODEL=gpt-3.5-turbo
```

### Restart and Verify

```bash
npm run dev
```

Look for this line in the console:

```md
- Name Extraction (OpenAI gpt-4o-mini)
```

That's it! The app will now use your selected model.

## Implementation Details

### Code Changes

1. **Environment Variable** (`.env.example`)

   ```env
   OPENAI_MODEL=gpt-4o-mini
   ```

2. **Service Constructor** (`nameExtractionService.ts`)

   ```typescript
   constructor(apiKey: string, model: string = 'gpt-4o-mini') {
     this.client = new OpenAI({ apiKey });
     this.model = model;
     console.log(`NameExtractionService initialized with model: ${this.model}`);
   }
   ```

3. **Using the Model** (all API calls)

   ```typescript
   const response = await this.client.chat.completions.create({
     model: this.model,  // Uses configured model
     // ...
   });
   ```

4. **Main App** (`index.ts`)

   ```typescript
   const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
   this.nameExtractor = new NameExtractionService(OPENAI_API_KEY, OPENAI_MODEL);
   ```

### Files Changed

- ✅ `.env.example` - Added OPENAI_MODEL variable
- ✅ `src/services/nameExtractionService.ts` - Made model configurable
- ✅ `src/index.ts` - Reads model from env and passes to service
- ✅ `README.md` - Added model configuration section
- ✅ `QUICKSTART.md` - Added model note
- ✅ `MODEL_SELECTION.md` - Comprehensive guide (NEW)

## Features

### 1. Easy Model Switching

No code changes needed! Just edit `.env`:

```env
OPENAI_MODEL=gpt-4o
```

### 2. Safe Defaults

If `OPENAI_MODEL` is not set, defaults to `gpt-4o-mini`:

```typescript
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
```

### 3. Console Feedback

Always shows which model is being used:

```md
Memory Glasses App initialized
Services ready:
- Memory MCP Client
- Name Extraction (OpenAI gpt-4o-mini)
- AssemblyAI (configured but using MentraOS transcription)
```

### 4. Per-Service Logging

Service initialization confirms the model:

```md
NameExtractionService initialized with model: gpt-4o-mini
```

## Benefits

### Cost Optimization

Switch to cheaper models for testing:

```env
# Development
OPENAI_MODEL=gpt-3.5-turbo

# Production
OPENAI_MODEL=gpt-4o-mini
```

### Quality Optimization

Switch to better models when accuracy matters:

```env
# For complex names or multilingual
OPENAI_MODEL=gpt-4o
```

### A/B Testing

Run two instances with different models:

```bash
# Terminal 1: Test with gpt-4o-mini
OPENAI_MODEL=gpt-4o-mini npm run dev

# Terminal 2: Test with gpt-4o
OPENAI_MODEL=gpt-4o npm run dev
```

## Model Options

### gpt-4o-mini (Default) ⭐

- **Cost**: $0.15/$0.60 per 1M tokens
- **Speed**: Very fast (500-1500ms)
- **Accuracy**: Excellent for this use case
- **Recommended**: Yes

### gpt-4o

- **Cost**: $2.50/$10.00 per 1M tokens
- **Speed**: Slower (1500-3000ms)
- **Accuracy**: Maximum
- **Recommended**: Premium users only

### gpt-4-turbo

- **Cost**: $10.00/$30.00 per 1M tokens
- **Speed**: Medium (1000-2500ms)
- **Accuracy**: Excellent
- **Recommended**: Alternative to gpt-4o

### gpt-3.5-turbo

- **Cost**: $0.50/$1.50 per 1M tokens
- **Speed**: Very fast (400-1000ms)
- **Accuracy**: Good (lower than GPT-4 models)
- **Recommended**: Testing only

See `MODEL_SELECTION.md` for detailed comparison.

## Testing

### Test Current Model

Check console on startup:

```md
- Name Extraction (OpenAI gpt-4o-mini)
```

### Test Model Switching

1. Edit `.env`:

   ```env
   OPENAI_MODEL=gpt-4o
   ```

2. Restart app:

   ```bash
   npm run dev
   ```

3. Check console:

   ```md
   - Name Extraction (OpenAI gpt-4o)
   ```

### Test Name Extraction

Say: "My name is John Smith"

Check console logs:

```md
NameExtractionService initialized with model: gpt-4o-mini
Transcription: My name is John Smith
✓ Name detected: John Smith (confidence: high)
```

## Backwards Compatibility

✅ **Fully backwards compatible!**

If `.env` doesn't have `OPENAI_MODEL`:

- Uses default: `gpt-4o-mini`
- No breaking changes
- Works exactly as before

## Future Extensions

### Per-Operation Models

Want different models for different tasks?

```typescript
// In nameExtractionService.ts
constructor(apiKey: string, extractionModel: string, summaryModel: string) {
  this.extractionModel = extractionModel;
  this.summaryModel = summaryModel;
}

async extractNames() {
  // Use extractionModel
}

async summarizeConversation() {
  // Use summaryModel
}
```

Then in `.env`:

```env
OPENAI_EXTRACTION_MODEL=gpt-4o-mini
OPENAI_SUMMARY_MODEL=gpt-4o
```

### Dynamic Model Selection

Based on conversation complexity:

```typescript
const model = transcript.length > 1000 ? 'gpt-4o' : 'gpt-4o-mini';
```

### Cost Tracking

Log costs per model:

```typescript
const cost = calculateCost(tokens, model);
console.log(`Model: ${model}, Cost: $${cost}`);
```

## Documentation

- **MODEL_SELECTION.md** - Complete guide to choosing models
  - All model options
  - Cost comparison tables
  - Performance metrics
  - Recommendation matrix
  - Advanced configuration
  - Troubleshooting

- **README.md** - Updated with model configuration
- **QUICKSTART.md** - Added model selection note
- **.env.example** - Has OPENAI_MODEL with comments

## Troubleshooting

### Model Not Found

**Error**: `The model 'gpt-5' does not exist`

**Solution**: Check spelling, use valid model name

### Wrong Model Being Used

**Issue**: Console shows different model than expected

**Solution**:

1. Check `.env` file
2. Restart the app
3. Verify no typos in model name

### High Costs

**Issue**: API costs are too high

**Solution**: Switch to cheaper model:

```env
OPENAI_MODEL=gpt-4o-mini
```

### Poor Accuracy

**Issue**: Names not being detected correctly

**Solution**: Switch to better model:

```env
OPENAI_MODEL=gpt-4o
```

## Summary

✅ **Model configuration is now easy!**

- Change one line in `.env`
- No code changes needed
- Safe defaults
- Console feedback
- Full documentation

**Recommended**: Keep `gpt-4o-mini` for production unless you need maximum accuracy.

---

**For detailed model comparison, costs, and recommendations, see:**
📖 `MODEL_SELECTION.md`
