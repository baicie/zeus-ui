<script setup lang="ts">
import type { ShowcaseComponent } from '@zeus-web/example-showcase-shared'
import {
  getShowcaseSectionDefinition,

  sortShowcaseSections,
} from '@zeus-web/example-showcase-shared'

import DemoGrid from './DemoGrid.vue'
import DemoPage from './DemoPage.vue'
import DemoSection from './DemoSection.vue'
import EventLog from './EventLog.vue'
import ImportSnippet from './ImportSnippet.vue'
import PropTable from './PropTable.vue'
import StateMatrix from './StateMatrix.vue'
import ThemeTokenPreview from './ThemeTokenPreview.vue'

const props = defineProps<{
  component: ShowcaseComponent
}>()

const sortedSections = sortShowcaseSections(props.component.sections)
</script>

<template>
  <DemoPage
    :eyebrow="component.group"
    :title="component.title"
    :description="component.description"
  >
    <template #meta>
      <span class="showcase-badge">{{ component.name }}</span>
      <span class="showcase-badge">{{ component.packageName }}</span>
    </template>

    <DemoSection
      title="Install and imports"
      description="Framework-specific import snippets and registry command."
    >
      <DemoGrid :columns="2">
        <ImportSnippet title="Package" :value="component.packageName" />
        <ImportSnippet
          title="Registry command"
          :value="component.registryCommand"
        />
        <ImportSnippet title="React" :value="component.imports.react" />
        <ImportSnippet title="Vue" :value="component.imports.vue" />
        <ImportSnippet
          title="Web Component"
          :value="component.imports.webComponent"
        />
      </DemoGrid>
    </DemoSection>

    <DemoSection
      title="Planned sections"
      description="The full component page will be implemented using this fixed section contract."
    >
      <div class="showcase-demo-grid showcase-demo-grid-3">
        <div
          v-for="section in sortedSections"
          :key="section"
          class="showcase-card"
        >
          <h3 class="showcase-card-title">
            {{ getShowcaseSectionDefinition(section).label }}
          </h3>
          <p class="showcase-card-description">
            {{ getShowcaseSectionDefinition(section).description }}
          </p>
          <span
            v-if="getShowcaseSectionDefinition(section).requiredForMvp"
            class="showcase-badge"
          >
            required
          </span>
        </div>
      </div>
    </DemoSection>

    <DemoSection
      title="States"
      description="State matrix placeholder. Real component rendering is added in later phases."
    >
      <StateMatrix :states="component.states" />
    </DemoSection>

    <DemoSection
      title="Events"
      description="Event names and framework callback aliases."
    >
      <EventLog :events="component.events" />
    </DemoSection>

    <DemoSection
      title="Props"
      description="Phase 3 provides the table shell. Component-specific prop rows are added later."
    >
      <PropTable :rows="[]" />
    </DemoSection>

    <DemoSection
      title="Theme tokens"
      description="Semantic tokens referenced by this component metadata."
    >
      <ThemeTokenPreview :tokens="component.themeTokens" />
    </DemoSection>

    <DemoSection
      title="Icon examples"
      description="Icons commonly used with this component."
    >
      <div
        v-if="component.iconExamples.length > 0"
        class="showcase-demo-grid showcase-demo-grid-3"
      >
        <div
          v-for="icon in component.iconExamples"
          :key="icon"
          class="showcase-card"
        >
          <span class="showcase-badge">{{ icon }}</span>
        </div>
      </div>

      <div v-else class="showcase-empty">No icon examples planned.</div>
    </DemoSection>

    <DemoSection
      title="Production patterns"
      description="Real-world usage scenarios that later demo pages must cover."
    >
      <div class="showcase-card">
        <ul class="showcase-list">
          <li v-for="pattern in component.productionPatterns" :key="pattern">
            {{ pattern }}
          </li>
        </ul>
      </div>
    </DemoSection>
  </DemoPage>
</template>
