# Testing Guide

Comprehensive testing scenarios to verify your Smart Glasses Memory Assistant works correctly.

## Pre-Test Checklist

Before running tests, ensure:
- [ ] App is running (`npm run dev`)
- [ ] ngrok is running and connected
- [ ] MentraOS app shows your app as available
- [ ] Glasses are connected to your phone
- [ ] App is launched on glasses
- [ ] You see "Memory Assistant Ready!" on glasses

## Test Suite

### Test 1: Basic Transcription

**Objective**: Verify audio capture and transcription works

**Steps**:
1. Say: "Testing one two three"
2. Check Terminal 1 for: `Transcription: Testing one two three`

**Expected Result**:
- ✅ Text appears in terminal within 1-2 seconds
- ✅ Text is accurate

**Troubleshooting**:
- No text appears → Check microphone permission in MentraOS Console
- Inaccurate text → Speak more clearly or adjust distance from mic

---

### Test 2: Name Detection (First Time)

**Objective**: Verify name extraction and storage

**Steps**:
1. Wait 5 seconds after Test 1 (clear buffer)
2. Say: "Hello, my name is John Smith"
3. Wait 35 seconds (30s buffer + 5s processing)
4. Check Terminal 1 for: `✓ Name detected: John Smith (confidence: high)`
5. Check glasses display

**Expected Result**:
- ✅ Terminal shows name detection after ~30s
- ✅ Glasses show "Nice to meet you John Smith!" for 4 seconds
- ✅ Memory MCP server stores the person

**Terminal Output Should Include**:
```
Transcription: Hello, my name is John Smith
✓ Name detected: John Smith (confidence: high)
Stored new person: John Smith
```

**Troubleshooting**:
- No name detected → Check OpenAI API key
- Wrong confidence level → Normal, depends on phrasing
- No storage → Check Memory MCP URL

---

### Test 3: Name Variations

**Objective**: Test different introduction patterns

**Test 3A**: "I'm" pattern
1. Start new session (disconnect and reconnect)
2. Say: "I'm Sarah Johnson"
3. Wait 35 seconds

**Expected**: ✅ Detects "Sarah Johnson"

**Test 3B**: "This is" pattern
1. Start new session
2. Say: "This is Mike Davis"
3. Wait 35 seconds

**Expected**: ✅ Detects "Mike Davis"

**Test 3C**: "Call me" pattern
1. Start new session
2. Say: "Call me Alex"
3. Wait 35 seconds

**Expected**: ✅ Detects "Alex"

---

### Test 4: Person Recognition

**Objective**: Verify memory retrieval and recognition

**Prerequisites**: Complete Test 2 successfully

**Steps**:
1. Disconnect glasses (end session)
2. Wait 5 seconds
3. Reconnect glasses (start new session)
4. Say: "Hi, I'm John Smith"
5. Wait 35 seconds
6. Check Terminal 1 and glasses

**Expected Result**:
- ✅ Terminal shows: `✓ Recognized: John Smith`
- ✅ Glasses show: "Welcome back John Smith!" (not "Nice to meet you")
- ✅ Terminal might show last conversation context

**Terminal Output Should Include**:
```
Transcription: Hi, I'm John Smith
✓ Name detected: John Smith (confidence: high)
Welcome back John Smith!
```

**Troubleshooting**:
- Shows "Nice to meet you" → Memory lookup failed, check MCP URL
- No recognition → Check name spelling consistency

---

### Test 5: Conversation Summary

**Objective**: Verify conversation is summarized and stored

**Steps**:
1. Start fresh session
2. Say: "My name is Jane Wilson"
3. Wait 35 seconds (name detected)
4. Say: "I'm planning a vacation to Hawaii next month"
5. Wait 5 seconds
6. Say: "I'm really excited about snorkeling and hiking"
7. Wait 5 seconds
8. Disconnect glasses (end session)
9. Check Terminal 1

**Expected Result**:
- ✅ Terminal shows: `=== Session Disconnected ===`
- ✅ Terminal shows: `Conversation summary saved`
- ✅ No errors during summary generation

**Next Session Test**:
1. Reconnect glasses
2. Say: "Hi, I'm Jane Wilson"
3. Wait 35 seconds
4. Check terminal and glasses

**Expected**:
- ✅ Shows recognition with context about Hawaii/vacation

---

### Test 6: Multiple Names in One Session

**Objective**: Test multiple people detection

**Steps**:
1. Start new session
2. Say: "Hello, my name is Tom"
3. Wait 35 seconds
4. Say: "And this is my friend Lisa"
5. Wait 35 seconds
6. Check terminal

**Expected Result**:
- ✅ Detects "Tom" first
- ✅ Detects "Lisa" second
- ✅ Both stored separately

**Note**: Due to POC limitation, both will be marked as "Speaker A". Full speaker separation comes in Phase 2.

---

### Test 7: API Error Handling

**Objective**: Verify graceful error handling

**Test 7A**: Invalid OpenAI Key
1. Stop the app
2. Edit .env - set invalid OPENAI_API_KEY
3. Restart app
4. Try name detection

**Expected**:
- ✅ Error logged to terminal
- ✅ App doesn't crash
- ✅ Clear error message about API key

**Test 7B**: Network Disconnection
1. Disconnect internet
2. Try name detection

**Expected**:
- ✅ Error logged
- ✅ App continues running
- ✅ Recovers when network returns

---

### Test 8: Performance Testing

**Objective**: Test sustained operation

**Steps**:
1. Start session
2. Say your name
3. Have a 5-minute conversation
4. Check terminal for memory usage and errors
5. Disconnect

**Expected Result**:
- ✅ No memory leaks
- ✅ Consistent performance
- ✅ All transcriptions processed
- ✅ Summary generated

**Monitor**:
- Buffer doesn't grow unbounded
- API calls are reasonable
- No error accumulation

---

### Test 9: Edge Cases

**Test 9A**: Very Long Name
- Say: "My name is Alexander Maximilian Montgomery the Third"
- Wait 35 seconds
- **Expected**: ✅ Full name detected and stored

**Test 9B**: Unusual Spellings
- Say: "I'm Siobhan" (Irish name, pronounced "Shi-vawn")
- Wait 35 seconds
- **Expected**: ✅ Name stored (spelling may vary)

**Test 9C**: No Introduction
- Have a conversation without saying your name
- Wait 60 seconds
- **Expected**: ✅ No false positives, no incorrect name detection

**Test 9D**: Multiple Introductions
- Say: "I'm John" (wait 35s)
- Say: "Actually, call me Jonathan" (wait 35s)
- **Expected**: ✅ Creates two entries or updates existing

---

### Test 10: Full Workflow Integration

**Objective**: Complete end-to-end test

**Day 1 - First Meeting**:
1. Start session
2. Say: "Hi, I'm David. I work at Acme Corp"
3. Wait 35 seconds
4. Say: "I'm working on a new AI project"
5. Conversation for 2 minutes about AI project
6. Say: "We're using Python and TensorFlow"
7. Disconnect

**Day 2 - Second Meeting**:
1. Start new session
2. Say: "Hey, it's David again"
3. Wait 35 seconds
4. Check display

**Expected Results**:
- ✅ "Welcome back David!"
- ✅ Shows context: "Last: discussed AI project"
- ✅ Terminal shows: Topics include "AI", "Python", "TensorFlow"

**Day 3 - Update Context**:
1. Start session
2. Say: "Hi, I'm David"
3. Wait 35 seconds (recognized)
4. Say: "That AI project launched successfully!"
5. Conversation about launch
6. Disconnect

**Day 4 - Verify Update**:
1. Start session
2. Say: "David here"
3. Wait 35 seconds

**Expected**:
- ✅ Shows updated context about project launch

---

## Automated Testing (Future)

For automated tests, you could:

1. **Mock MentraOS SDK**:
```typescript
// test/mocks/mentraos.mock.ts
export class MockAppSession {
  events = new MockEventManager();
  layouts = new MockLayoutManager();
}
```

2. **Unit Test Services**:
```typescript
// test/services/nameExtraction.test.ts
describe('NameExtractionService', () => {
  it('should extract name from introduction', async () => {
    const service = new NameExtractionService(API_KEY);
    const names = await service.extractNames("I'm John");
    expect(names[0].name).toBe("John");
  });
});
```

3. **Integration Tests**:
```typescript
// test/integration/conversation.test.ts
describe('Conversation Flow', () => {
  it('should recognize person on second meeting', async () => {
    // Test full workflow
  });
});
```

## Performance Benchmarks

### Target Metrics

- **Name Detection Latency**: < 35 seconds (batch interval)
- **API Response Time**: < 2 seconds (Claude)
- **Memory Query Time**: < 1 second
- **Display Update Time**: < 500ms

### Measuring Performance

Add timing logs:
```typescript
const start = Date.now();
const names = await this.nameExtractor.extractNames(transcript);
console.log(`Name extraction took ${Date.now() - start}ms`);
```

**Expected GPT-4o-mini Performance**:
- Name extraction: 500-1500ms
- Summarization: 800-2000ms
- Very responsive compared to larger models

## Test Results Template

Use this to track your testing:

```
# Test Session: [Date]

## Environment
- Node Version:
- MentraOS SDK Version:
- Glasses Model:

## Test Results

### Test 1: Basic Transcription
- Status: ✅ / ❌
- Notes:

### Test 2: Name Detection (First Time)
- Status: ✅ / ❌
- Detection Time: ____ seconds
- Notes:

### Test 3: Name Variations
- 3A (I'm): ✅ / ❌
- 3B (This is): ✅ / ❌
- 3C (Call me): ✅ / ❌

### Test 4: Person Recognition
- Status: ✅ / ❌
- Recognition Time: ____ seconds
- Context Displayed: ✅ / ❌

### Test 5: Conversation Summary
- Status: ✅ / ❌
- Summary Quality: Good / Fair / Poor
- Notes:

### Test 6: Multiple Names
- Status: ✅ / ❌
- Both Detected: ✅ / ❌

### Test 7: Error Handling
- 7A (Invalid Key): ✅ / ❌
- 7B (Network): ✅ / ❌

### Test 8: Performance
- Status: ✅ / ❌
- Memory Usage: Normal / High
- Any Issues:

### Test 9: Edge Cases
- 9A (Long Name): ✅ / ❌
- 9B (Unusual): ✅ / ❌
- 9C (No Intro): ✅ / ❌
- 9D (Multiple): ✅ / ❌

### Test 10: Full Workflow
- Day 1: ✅ / ❌
- Day 2: ✅ / ❌
- Day 3: ✅ / ❌
- Day 4: ✅ / ❌

## Overall Assessment
- Pass Rate: ____ / 10
- Critical Issues:
- Notes:

## API Usage
- Claude API Calls: ____
- Estimated Cost: $____
- Memory Ops: ____
```

## Debugging Checklist

If a test fails, check:

1. **Terminal 1 Output**
   - Any error messages?
   - Transcription appearing?
   - Name detection logs?

2. **Terminal 2 (ngrok)**
   - Connection active?
   - Requests coming through?

3. **Environment Variables**
   - All keys present?
   - No typos?
   - Keys valid?

4. **MentraOS Console**
   - App registered?
   - Microphone permission?
   - URL matches ngrok?

5. **Network**
   - Internet connected?
   - APIs reachable?
   - Firewall issues?

6. **Glasses**
   - Connected to phone?
   - App launched?
   - Audio working?

## Success Criteria

For POC to be considered "passing":

Minimum Requirements:
- ✅ Tests 1, 2, 4, 5 must pass
- ✅ At least 2/3 name variations work (Test 3)
- ✅ No crashes during normal operation
- ✅ Errors are logged and handled

Excellent Performance:
- ✅ All 10 tests pass
- ✅ < 35s name detection latency
- ✅ 90%+ name accuracy
- ✅ Conversation summaries are coherent

## Next Steps After Testing

Once tests pass:
1. ✅ Mark Test 1-10 complete
2. Try with real conversations
3. Gather feedback from others
4. Identify pain points
5. Plan Phase 2 enhancements

## Reporting Issues

If you find bugs, note:
- Test number that failed
- Exact steps to reproduce
- Terminal output (both terminals)
- Expected vs actual behavior
- Environment details

---

Happy Testing! 🧪

Remember: This is a POC. Some rough edges are expected. The goal is to validate the concept, not achieve perfection.
