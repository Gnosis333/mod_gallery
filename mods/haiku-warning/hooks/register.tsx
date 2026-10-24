import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const model = atom({ plugin: 'haiku-warning', key: 'model' } as const, '')

const isHaiku = (id: string) => /haiku/i.test(id)

const WARNING = {
  en: (id: string) => `Heads up: the Haiku model (${id}) is selected. Switch with /model for complex work.`,
  ko: (id: string) => `주의: 현재 Haiku 모델(${id})이 선택되어 있습니다. 복잡한 작업은 /model 로 바꾸세요.`,
}

export const register: Register = (on, options) => {
  // `language` is a field of the plugin's userConfig: 'en' (default) or 'ko'
  const warning = WARNING[options.language === 'ko' ? 'ko' : 'en']

  on('session.start', async ($, e, next) => {
    const refresh = async () => {
      const current = await $.session.model()
      if (current !== (await read($, model))) {
        await update($, model, () => current)
      }
    }

    await refresh()
    // A model picked in the picker shows up here without waiting for a prompt.
    $.clock.every(1000, () => void refresh().catch(() => {}))

    return next(e)
  })

  on('classic.PostModelSwitch', async ($, e, next) => {
    await update($, model, () => e.to_model)

    return next(e)
  }).catch(($, e, next) => next(e))

  // Fallback: catch a switch the event did not report before each prompt.
  on('prompt.submit', async ($, e, next) => {
    const current = await $.session.model()
    await update($, model, () => current)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const id = await read($, model)

    if (e.props.hasSurvey || !isHaiku(id)) {
      return next(e)
    }

    const { Text } = $.ui.resolve(e)

    return (
      <Text color="error" bold>
        {`⚠ ${warning(id)}`}
      </Text>
    )
  })
}
