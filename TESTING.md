# Test Automation

This project uses [Vitest](https://vitest.dev/) for testing business logic and API endpoints.

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode (default)
npm test

# Run tests once (CI mode)
npm test run

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
src/
├── lib/
│   ├── __tests__/
│   │   └── matchmaker.test.ts          # Matchmaking algorithm tests
├── app/
│   └── api/
│       ├── matches/
│       │   └── __tests__/
│       │       └── stats-update.test.ts    # Stats update logic tests
│       └── session/
│           └── __tests__/
│               └── deletion-recalc.test.ts # Session deletion tests
tests/
├── helpers/
│   ├── mock-storage.ts                 # MockStorageAdapter for testing
│   └── fixtures.ts                     # Test data factories
```

## What's Tested

### ✅ Matchmaking Algorithm ([src/lib/__tests__/matchmaker.test.ts](src/lib/__tests__/matchmaker.test.ts))
- Insufficient players handling
- Fatigue prevention (players who played last 2 consecutive matches)
- Winner pair splitting rule
- Edge cases (all players fatigued, no winner in last match)

**Coverage**: 100% of [src/lib/matchmaker.ts](src/lib/matchmaker.ts)

### ✅ Stats Update Logic ([src/app/api/matches/__tests__/stats-update.test.ts](src/app/api/matches/__tests__/stats-update.test.ts))
- First-time match completion
- Score corrections (reversal + reapplication)
- Tie handling
- Multiple score updates
- Unfinished match handling

**Tests**: Stats recalculation when match scores are updated

### ✅ Session Deletion with Recalculation ([src/app/api/session/__tests__/deletion-recalc.test.ts](src/app/api/session/__tests__/deletion-recalc.test.ts))
- Cascade deletion of matches
- Stats recalculation from remaining matches
- Reset to zero when deleting last session
- Only counting finished matches
- Validation (cannot delete active session)

**Tests**: DELETE /api/session/[id] business logic

## Test Helpers

### MockStorageAdapter
In-memory implementation of `StorageAdapter` interface for fast, isolated testing.

```typescript
import { MockStorageAdapter } from '@/../tests/helpers/mock-storage';

const storage = new MockStorageAdapter();

// Seed with test data
storage.seed(players, sessions, matches);

// Reset between tests
storage.reset();
```

### Fixture Factories
Helper functions to create test data:

```typescript
import { createPlayer, createSession, createMatch } from '@/../tests/helpers/fixtures';

const player = createPlayer({ id: 'p1', name: 'Test Player' });
const session = createSession({ id: 's1', isActive: true });
const match = createMatch({ sessionId: 's1', score1: 11, score2: 8 });
```

## Coverage Report

Current coverage (business logic focus):

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| matchmaker.ts | 100% | 96% | 100% | 100% |

Run `npm run test:coverage` to generate a full HTML coverage report in `coverage/index.html`.

## CI/CD

Tests run automatically on push and pull requests via GitHub Actions. See [.github/workflows/test.yml](.github/workflows/test.yml).

## Writing New Tests

1. Create a `__tests__` folder next to the code you're testing
2. Name test files `*.test.ts`
3. Use `describe` blocks to group related tests
4. Use `beforeEach` to reset state between tests

Example:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup code
  });

  it('should do something', () => {
    // Test code
    expect(result).toBe(expected);
  });
});
```

## Future Testing Plans

- [ ] API route integration tests (with HTTP request mocking)
- [ ] Storage adapter tests (JsonFileAdapter, FirestoreAdapter)
- [ ] Component tests (React Testing Library)
- [ ] E2E tests (Playwright)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest UI](https://vitest.dev/guide/ui.html)
- [Coverage Reports](https://vitest.dev/guide/coverage.html)
