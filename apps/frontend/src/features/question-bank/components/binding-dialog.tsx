import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfigForm, type FieldConfig } from '@/components/common/config-form'
import { getConfigOptions, bindConfig, type ConfigOptions, type BindConfigData } from '@/features/question-bank/api'
import { useConfigStore } from '@/stores/config.store'

interface BindingDialogProps {
  open: boolean
  onClose: () => void
  forceOpen?: boolean
}

const schema = z.object({
  province: z.string().min(1, '请选择省份'),
  language: z.string().min(1, '请选择语种'),
  examType: z.string().min(1, '请选择考试类型'),
  interviewForm: z.string().min(1, '请选择面试形式'),
})

export function BindingDialog({ open, onClose, forceOpen = false }: BindingDialogProps) {
  const { t } = useTranslation()
  const { setConfig, config } = useConfigStore()
  const [options, setOptions] = useState<ConfigOptions | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setIsLoading(true)
      getConfigOptions()
        .then(setOptions)
        .catch(() => setError('加载选项失败，请刷新重试'))
        .finally(() => setIsLoading(false))
    }
  }, [open])

  const handleSubmit = async (values: z.infer<typeof schema>) => {
    setIsSubmitting(true)
    try {
      const result = await bindConfig(values as BindConfigData)
      setConfig({
        province: values.province,
        language: values.language,
        examType: values.examType,
        interviewForm: values.interviewForm,
        bankId: result.bankId,
        bankName: result.bankName,
      })
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || '绑定失败，请重试'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const fields: FieldConfig[] = [
    {
      name: 'province',
      label: t('binding.province'),
      type: 'select',
      required: true,
      placeholder: t('binding.selectProvince'),
      options: options?.provinces || [],
    },
    {
      name: 'language',
      label: t('binding.language'),
      type: 'select',
      required: true,
      placeholder: t('binding.selectLanguage'),
      options: options?.languages || [],
    },
    {
      name: 'examType',
      label: t('binding.examType'),
      type: 'select',
      required: true,
      placeholder: t('binding.selectExamType'),
      options: options?.examTypes || [],
    },
    {
      name: 'interviewForm',
      label: t('binding.interviewForm'),
      type: 'select',
      required: true,
      placeholder: t('binding.selectInterviewForm'),
      options: options?.interviewForms || [],
    },
  ]

  const defaultValues: Record<string, string> = config
    ? {
        province: config.province,
        language: config.language,
        examType: config.examType,
        interviewForm: config.interviewForm,
      }
    : {}

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !forceOpen) onClose() }}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-[480px] sm:w-full"
        onInteractOutside={(e) => { if (forceOpen) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (forceOpen) e.preventDefault() }}
      >
        <DialogHeader>
          <DialogTitle>{t('binding.title')}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
        ) : error && !options ? (
          <div className="py-8 text-center text-destructive">{error}</div>
        ) : (
          <>
            {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
            <ConfigForm
              fields={fields}
              schema={schema}
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              submitLabel={t('binding.confirm')}
              isLoading={isSubmitting}
              onCancel={forceOpen ? undefined : onClose}
              cancelLabel={t('common.cancel')}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
