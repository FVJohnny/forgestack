# Code Style

> Quick in-repo reference. The canonical pages are **[Enforced Boundaries](https://forgestack.fvjohnny.com/docs/backend/eslint-rules)** and **[Project Structure](https://forgestack.fvjohnny.com/docs/project-structure#naming-as-a-contract)** on the docs site; when the two disagree, the docs site wins.

## Formatting

- TypeScript, 2-space indentation, single quotes, trailing commas, print width 100 (`.prettierrc`). `npm run lint` checks it and the pre-commit hook fixes staged files.
- camelCase for methods and variables, `UPPER_SNAKE_CASE` for env vars and injection tokens (`TASK_REPOSITORY`).

## Naming (backend)

Names follow the role a file plays, and they are load-bearing: the lint rules pick which base class a file must extend by its suffix, and the runtime auto-discovery finds handlers and controllers by suffix too. A misnamed handler is either a lint error or silently not registered.

### Files: kebab-case plus a role suffix

`<name>.<role>.ts`, in one folder per use case. For example, `application/commands/create-task/` holds `create-task.command.ts`, `create-task.command-handler.ts` and its spec.

| Layer          | Suffixes                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| domain         | `.aggregate.ts`, `.vo.ts`, `.dto.ts`, `.domain-event.ts`, `.repository.ts` (the port), `.service.ts` (a port)                       |
| application    | `.command.ts`, `.command-handler.ts`, `.query.ts`, `.query-handler.ts`, `.query-response.ts`, `.domain-event-handler.ts`            |
| infrastructure | `.mongodb-repository.ts`, `.in-memory-repository.ts`, `.<technology>-service.ts` (e.g. `.smtp-service.ts`, `.in-memory-service.ts`) |
| interfaces     | `.controller.ts`, `.params.ts`, `.controller-response.ts`, `.integration-event-handler.ts`                                          |
| shared libs    | `.integration-event.ts` (the cross-context contracts in `backend/libs/common`)                                                      |

A domain-event handler that does one thing is named after the event and the action: `user-registered_create-email-verification.domain-event-handler.ts`.

### Classes: `Name_Role`

Classes are PascalCase, with the role appended after an underscore so it matches the file suffix:

| Role                        | Example                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Command / handler           | `CreateTask_Command`, `CreateTask_CommandHandler`                                                 |
| Query / handler / result    | `ListTasks_Query`, `ListTasks_QueryHandler`, `ListTasks_QueryResponse`                            |
| Domain event / handler      | `UserRegistered_DomainEvent`, `UserRegistered_CreateEmailVerification_DomainEventHandler`         |
| Integration event / handler | `UserCreated_IntegrationEvent`, `UserCreated_IntegrationEventHandler`                             |
| Controller / input          | `CreateTask_Controller`, `CreateTask_ControllerParams`                                            |
| Port (interface) + token    | `Task_Repository` + `TASK_REPOSITORY`, `Email_Service` + `EMAIL_SERVICE`                          |
| Adapter                     | `Task_MongodbRepository`, `Task_InMemoryRepository`, `Email_SmtpService`, `Email_InMemoryService` |

Business concepts keep plain business names: aggregates (`Task`, `User`), value objects (`TaskTitle`, `Email`) and their DTOs (`TaskDTO`). A context's module is `<Context>BoundedContextModule` in `<context>.module.ts`.

`handler/naming` enforces the handler suffixes, `cqrs/handler-collocation` the one-folder-per-use-case layout, `value-object/naming` the `.vo.ts` rule, and the `*/must-extend-base` rules the base class behind each suffix.

## Where things live

- Reusable DTOs and domain primitives belong in `backend/libs`, exported from `index.ts`.

## TypeScript rules

- **No `as any`**: use `as unknown as Record<string, unknown>` for legacy field handling, proper types everywhere else
- **No `||` fallbacks for optional fields**: fields that should always have a value must be required in the DTO/type. Use `??` only when null/undefined is genuinely possible
- **No defaults at the controller layer**: usually, no fields are optional.
- **No inline unions like `'active' | 'pending'`**: use proper named types and enums instead of inline string-literal unions

## Domain modelling

- **Value objects compare with themselves**: do not reach inside a VO to do string manipulation for comparison. If two VOs need to be compared, use `.toValue()` equality or make methods in the VOs to do that comparison.
- **Always use VOs inside the domain**: domain methods (aggregate methods, domain services) take and return value objects like `Id`, `Email`, etc., never raw `string` / `number`. Call `.toValue()` only when crossing to a DTO, integration event payload, or external boundary. If a method signature accepts `userId: string`, that's a bug: change it to `userId: Id`. This applies to new code AND to passing values _through_ existing methods (e.g. don't pass a raw `command.userId` string into a domain method, lift it to `new Id(command.userId)` at the application-layer boundary first).

## i18n

- **Key naming**: translation keys must match the domain type value directly (e.g. `EMAIL_VERIFIED` not `emailVerified`) so lookups like `t(entity.status)` work without a mapping helper

## Comments

- Add comments where they clarify intent or non-obvious logic. Avoid over-commenting obvious code, but don't be afraid to explain the "why" behind a decision.
