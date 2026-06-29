<script setup lang="ts">
const props = defineProps<{
  text: string;
}>();
</script>

<template>
  <v-card>
    <v-card-title class="text-center">
      {{ text }}
    </v-card-title>
    <v-card-text>
      <img src="/image/sumimasen.png" alt="私密马赛！" />
    </v-card-text>
  </v-card>
</template>

<style scoped></style>
