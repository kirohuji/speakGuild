import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'

export interface SelectOption {
  label: string
  value: string
}

export interface FieldConfig {
  name: string
  label: string
  type: 'text' | 'select' | 'textarea' | 'switch' | 'number' | 'email' | 'password'
  placeholder?: string
  options?: SelectOption[]
  required?: boolean
  validation?: z.ZodType
  description?: string
  disabled?: boolean
}

export interface ConfigFormProps {
  fields: FieldConfig[]
  schema: z.ZodSchema<any>
  defaultValues?: Record<string, any>
  onSubmit: (values: any) => void | Promise<void>
  submitLabel?: string
  isLoading?: boolean
  className?: string
  onCancel?: () => void
  cancelLabel?: string
}

export function ConfigForm({
  fields,
  schema,
  defaultValues,
  onSubmit,
  submitLabel = '提交',
  isLoading = false,
  className,
  onCancel,
  cancelLabel = '取消',
}: ConfigFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema as any),
    defaultValues,
  })

  const handleFormSubmit = async (values: any) => {
    await onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className={cn('space-y-4', className)}>
      {fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          {field.type !== 'switch' && (
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="ml-1 text-destructive">*</span>}
            </Label>
          )}

          {field.type === 'text' || field.type === 'email' || field.type === 'password' || field.type === 'number' ? (
            <Input
              id={field.name}
              type={field.type}
              placeholder={field.placeholder}
              disabled={field.disabled || isLoading}
              {...register(field.name)}
            />
          ) : field.type === 'select' ? (
            <Controller
              name={field.name}
              control={control}
              render={({ field: f }) => (
                <Select
                  id={field.name}
                  value={f.value || ''}
                  onChange={(e) => f.onChange(e.target.value)}
                  disabled={field.disabled || isLoading}
                >
                  <SelectItem value="" disabled>
                    {field.placeholder || `请选择${field.label}`}
                  </SelectItem>
                  {field.options?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </Select>
              )}
            />
          ) : field.type === 'textarea' ? (
            <textarea
              id={field.name}
              placeholder={field.placeholder}
              disabled={field.disabled || isLoading}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              {...register(field.name)}
            />
          ) : field.type === 'switch' ? (
            <div className="flex items-center gap-3">
              <Controller
                name={field.name}
                control={control}
                render={({ field: f }) => (
                  <Switch
                    id={field.name}
                    checked={!!f.value}
                    onCheckedChange={f.onChange}
                    disabled={field.disabled || isLoading}
                  />
                )}
              />
              <Label htmlFor={field.name}>{field.label}</Label>
            </div>
          ) : null}

          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}

          {errors[field.name] && (
            <p className="text-xs text-destructive">
              {(errors[field.name] as any)?.message || '该字段无效'}
            </p>
          )}
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="flex-1">
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className={onCancel ? 'flex-1' : 'w-full'}>
          {isLoading ? '处理中...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
