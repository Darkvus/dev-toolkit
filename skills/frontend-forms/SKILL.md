---
name: frontend-forms
description: "Form conventions with React Hook Form + Zod + shadcn/ui Field components: form schemas, accessible fields, mapping backend 400 errors to fields, PATCH with dirty fields, submit states. Use when building or reviewing forms."
---

# Forms

Forms use **React Hook Form** for state, **Zod** for validation and the shadcn **`Field`** components for markup. Validation runs in the browser first, and the backend's 400 response is always mapped back onto the same fields.

## Form schema vs API schema

A form has its own Zod schema describing what the **user edits**, which is often different from the API contract ([[frontend-data-fetching]]):

```ts
// src/features/vehicles/schemas/vehicle.ts
// Form model: what the user edits. Money is typed as text and converted to cents on submit.
export const vehicleFormSchema = z.object({
  plate: z.string().trim().min(1, "Plate is required.").max(12, "Max 12 characters."),
  partner: z.string().min(1, "Partner is required."),
  daily_price: z.string().regex(/^\d+([.,]\d{1,2})?$/, "Use a price like 45 or 45.50."),
})
export type VehicleFormValues = z.infer<typeof vehicleFormSchema>
```

- Client rules mirror the backend rules (lengths, required) so most errors never reach the server, but the backend remains the authority.
- Convert units at submit time (text → cents, local date → UTC) with the helpers from [[frontend-units-and-formatting]].
- `defaultValues` are always complete (every field set, `""` rather than `undefined`) so inputs stay controlled.

## Field anatomy

Use `Controller` + `Field`. `data-invalid` on `Field` drives the styling; `aria-invalid` on the control drives accessibility. Every control has a `FieldLabel` linked by `htmlFor`/`id`:

```tsx
<Controller
  name="plate"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="vehicle-plate">Plate</FieldLabel>
      <Input {...field} id="vehicle-plate" aria-invalid={fieldState.invalid} autoComplete="off" />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

Group related fields with `FieldGroup`; use `FieldSet` + `FieldLegend` for radio/checkbox groups; put help text in `FieldDescription`, never in the placeholder.

## Mapping backend errors

Backend 400s follow the envelope in [[backend-api-design]]. `applyApiErrors` puts field messages on the matching field and everything else on `root.server`:

```ts
// src/lib/forms.ts
import type { FieldValues, Path, UseFormSetError } from "react-hook-form"

import { ApiError } from "@/lib/api/errors"

export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError)) return false
  const unknownFieldMessages: string[] = []
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: "server", message })
    } else {
      unknownFieldMessages.push(message)
    }
  }
  const general = [...error.generalErrors, ...unknownFieldMessages]
  if (general.length > 0) {
    setError("root.server", { type: "server", message: general.join(" ") })
  }
  return true
}

/** Only the fields the user changed — partial updates send exactly these (PATCH). */
export function pickDirty<T extends Record<string, unknown>>(
  values: T,
  dirtyFields: Partial<Record<keyof T, unknown>>,
): Partial<T> {
  const result: Partial<T> = {}
  for (const key of Object.keys(dirtyFields) as (keyof T)[]) {
    if (dirtyFields[key]) result[key] = values[key]
  }
  return result
}
```

Because form fields and API fields share the backend's `snake_case` names, no mapping table is needed. If a form field is named differently, map it explicitly before calling `setError`.

## Complete example (create)

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useCreateVehicle } from "@/features/vehicles/api/vehicles"
import { vehicleFormSchema, type VehicleFormValues } from "@/features/vehicles/schemas/vehicle"
import { parseMoneyToCents } from "@/lib/format"
import { applyApiErrors } from "@/lib/forms"

const FIELDS = ["plate", "partner", "daily_price"] as const

export function VehicleCreateForm({ onCreated }: { onCreated?: () => void }) {
  const createVehicle = useCreateVehicle()
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: { plate: "", partner: "", daily_price: "" },
  })

  async function onSubmit(values: VehicleFormValues) {
    try {
      await createVehicle.mutateAsync({
        plate: values.plate,
        partner: values.partner,
        daily_price: parseMoneyToCents(values.daily_price) ?? 0,
      })
      toast.success("Vehicle created")
      form.reset()
      onCreated?.()
    } catch (error) {
      if (!applyApiErrors(error, form.setError, FIELDS)) throw error
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          name="plate"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="vehicle-plate">Plate</FieldLabel>
              <Input {...field} id="vehicle-plate" aria-invalid={fieldState.invalid} autoComplete="off" />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {/* partner and daily_price follow the same pattern */}
        {form.formState.errors.root?.server && (
          <FieldError role="alert">{form.formState.errors.root.server.message}</FieldError>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Create vehicle"}
        </Button>
      </FieldGroup>
    </form>
  )
}
```

## Edit forms (PATCH)

- Load the resource, then `form.reset(toFormValues(resource))` once it arrives, so `isDirty` starts clean.
- Submit only the changed fields: `updateVehicle.mutateAsync(toApiChanges(pickDirty(values, form.formState.dirtyFields)))`.
- Disable the submit button while `!form.formState.isDirty` or `isSubmitting`.
- Warn before leaving a dirty form (React Router `useBlocker`).

## Rules

1. `noValidate` on `<form>`: Zod owns validation, not the browser's native bubbles.
2. The submit button shows progress and is disabled while submitting; never allow double submits.
3. Unexpected errors (network, 5xx) are re-thrown, so the global handler / `toast.error` shows them; only `ApiError`s are mapped onto the form.
4. Success feedback is a `toast.success`, then close the dialog or navigate. Do not leave the user guessing.
5. Long forms are split into `FieldSet`s with legends, not into multiple independent forms that save separately.
