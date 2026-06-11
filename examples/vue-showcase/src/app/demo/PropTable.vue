<script setup lang="ts">
interface PropTableRow {
  name: string
  type: string
  defaultValue?: string
  description: string
}

defineProps<{
  rows: PropTableRow[]
}>()
</script>

<template>
  <div v-if="rows.length === 0" class="showcase-empty">
    No props documented yet.
  </div>

  <div v-else class="showcase-table-wrap">
    <table class="showcase-table">
      <thead>
        <tr>
          <th>Prop</th>
          <th>Type</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="row in rows" :key="row.name">
          <td>
            <code>{{ row.name }}</code>
          </td>
          <td>
            <code>{{ row.type }}</code>
          </td>
          <td>
            <code v-if="row.defaultValue">{{ row.defaultValue }}</code>
            <span v-else>—</span>
          </td>
          <td>{{ row.description }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
