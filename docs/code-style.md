# Code Style

## Formatting

- TypeScript, 2-space indentation, single quotes, trailing commas, print width 100 (`.prettierrc`)
- PascalCase for classes/filenames, camelCase for methods, `UPPER_SNAKE_CASE` for env constants

## Where things live

- Reusable DTOs and domain primitives belong in `backend/libs`, exported from `index.ts`

## TypeScript rules

- **No `as any`** — use `as unknown as Record<string, unknown>` for legacy field handling, proper types everywhere else
- **No `||` fallbacks for optional fields** — fields that should always have a value must be required in the DTO/type. Use `??` only when null/undefined is genuinely possible
- **No defaults at the controller layer** — usually, no fields are optional.
- **No inline unions like `'active' | 'pending'`** — use proper named types and enums instead of inline string-literal unions

## Domain modelling

- **Value objects compare with themselves** — do not reach inside a VO to do string manipulation for comparison. If two VOs need to be compared, use `.toValue()` equality or make methods in the VOs to do that comparison.
- **Always use VOs inside the domain** — domain methods (aggregate methods, domain services) take and return value objects like `Id`, `Email`, etc., never raw `string` / `number`. Call `.toValue()` only when crossing to a DTO, integration event payload, or external boundary. If a method signature accepts `userId: string`, that's a bug — change it to `userId: Id`. This applies to new code AND to passing values *through* existing methods (e.g. don't pass a raw `command.userId` string into a domain method — lift it to `new Id(command.userId)` at the application-layer boundary first).

## i18n

- **Key naming** — translation keys must match the domain type value directly (e.g. `EMAIL_VERIFIED` not `emailVerified`) so lookups like `t(entity.status)` work without a mapping helper

## Comments

- Add comments where they clarify intent or non-obvious logic. Avoid over-commenting obvious code, but don't be afraid to explain the "why" behind a decision.
