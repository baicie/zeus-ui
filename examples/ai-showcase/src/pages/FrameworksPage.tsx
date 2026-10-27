/**
 * The same S1 conversation rendered three times — React, Vue and Web
 * Components — over one session. Sending from any composer updates all
 * three timelines; the adapters share one view description.
 */

import {
  createComposerController,
  createConversationController,
} from '@zeus-web/ai-core'
import { AiComposer, AiMessageTimeline } from '@zeus-web/ai-react'
import {
  AiComposer as VueComposer,
  AiMessageTimeline as VueTimeline,
} from '@zeus-web/ai-vue'
import { defineAiComposer, defineAiMessageTimeline } from '@zeus-web/ai-wc'
import { useEffect, useRef } from 'react'
import { createApp, h } from 'vue'
import { session } from '../session'

const CONVERSATION = 'frameworks'

function controllers() {
  const conversation = createConversationController({
    session,
    conversationId: CONVERSATION,
  })
  const composer = createComposerController({
    session,
    conversationId: CONVERSATION,
    parentMessageId: () => conversation.getSnapshot().leafMessageId,
  })
  return { conversation, composer }
}

const react = controllers()
const vue = controllers()
const wc = controllers()

function VuePanel() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const app = createApp({
      render: () =>
        h('div', [
          h(VueTimeline, {
            conversation: vue.conversation,
            session,
            label: 'Vue conversation',
          }),
          h(VueComposer, { controller: vue.composer, label: 'Ask from Vue' }),
        ]),
    })
    app.mount(ref.current!)
    return () => app.unmount()
  }, [])
  return <div ref={ref} />
}

function WcPanel() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    defineAiComposer()
    defineAiMessageTimeline()
    const timeline = Object.assign(
      document.createElement('zw-ai-message-timeline'),
      {
        session,
        conversation: wc.conversation,
      },
    )
    timeline.setAttribute('label', 'Web Component conversation')
    const composer = Object.assign(document.createElement('zw-ai-composer'), {
      controller: wc.composer,
    })
    composer.setAttribute('label', 'Ask from Web Components')
    ref.current!.append(timeline, composer)
    return () => {
      timeline.remove()
      composer.remove()
    }
  }, [])
  return <div ref={ref} />
}

export function FrameworksPage() {
  return (
    <section className="story" aria-labelledby="frameworks-title">
      <header className="story-header">
        <h1 id="frameworks-title">One conversation, three renderers</h1>
      </header>
      <div className="frameworks">
        <article data-framework="react" aria-label="React">
          <h2>React</h2>
          <AiMessageTimeline
            conversation={react.conversation}
            session={session}
            label="React conversation"
          />
          <AiComposer controller={react.composer} label="Ask from React" />
        </article>
        <article data-framework="vue" aria-label="Vue">
          <h2>Vue</h2>
          <VuePanel />
        </article>
        <article data-framework="wc" aria-label="Web Components">
          <h2>Web Components</h2>
          <WcPanel />
        </article>
      </div>
    </section>
  )
}
