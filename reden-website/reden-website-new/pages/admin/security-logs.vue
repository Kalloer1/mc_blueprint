<script lang="ts" setup>
import { UAParser } from 'ua-parser-js';
import randomColor from 'randomcolor';

type SecurityLevel =
  | 'Debug'
  | 'Verbose'
  | 'Info'
  | 'Warning'
  | 'Error'
  | 'Critical';
type Request = {
  level: SecurityLevel;
  timeStart: number;
  timeEnd: number;
  ip?: string;
  subjectSearch?: string;
  messageSearch?: string;
  isSuspicious?: boolean;
  detailsSearch?: string;
  uid?: number;
  limit: number;
  offset: number;
};
function colorFor(text: string) {
  return randomColor({
    // luminosity: 'dark',
    seed: text,
  });
}
type SecurityLog = {
  level: SecurityLevel;
  subject: string;
  message: string;
  time: number;
  suspicious: boolean;
  uid?: number;
  requestId?: string;
  requestUrl?: string;
  ip?: string;
  details?: string;
  userAgent?: string;
};
const totalItems = ref(10000000); // use a very large number to avoid reload
const serverItems = ref<SecurityLog[]>([]);
const loading = ref(false);

async function loadItems(options: {
  page: number;
  itemsPerPage: number;
  sortBy: {
    key: string;
    order: 'asc' | 'desc';
  }[];
  sortDesc: boolean;
}) {
  if (import.meta.client) {
    loading.value = true;
    const request: Request = {
      level: 'Info',
      timeStart: 0,
      timeEnd: new Date().getTime(),
      limit: options.itemsPerPage,
      offset: (options.page - 1) * options.itemsPerPage,
    };
    const response = await doFetchPost('/api/admin/security/log', request);
    if (response.ok) {
      const data: {
        list: SecurityLog[];
        total: number;
      } = await response.json();
      serverItems.value = data.list;
      totalItems.value = data.total;
    } else {
      await toastError(response);
    }
    loading.value = false;
  }
}
</script>

<template>
  <v-data-table-server
    :headers="[
      { title: 'Level', key: 'level' },
      { title: 'Subject', key: 'subject' },
      { title: 'Time', key: 'time' },
      { title: 'Suspicious', key: 'suspicious' },
      { title: 'UID', key: 'uid' },
      { title: 'Request ID', key: 'requestId' },
      { title: 'IP', key: 'ip' },
      { title: 'User Agent', key: 'userAgent' },
      { title: 'Actions', key: 'actions' },
    ]"
    :items="serverItems"
    :items-length="totalItems"
    :loading="loading"
    @update:options="loadItems"
  >
    <template #[`item.level`]="{ item }">
      <v-chip
        :color="
          {
            Debug: 'grey',
            Verbose: 'grey',
            Info: 'blue',
            Warning: 'orange',
            Error: 'red',
            Critical: 'red',
          }[item.level]
        "
        dark
        small
        variant="flat"
        v-text="item.level"
      />
    </template>
    <template #[`item.time`]="{ item }">
      {{ new Date(item.time).toLocaleString() }}
    </template>
    <template #[`item.userAgent`]="{ item }">
      <v-chip
        dark
        small
        variant="flat"
        :color="colorFor(UAParser(item.userAgent).browser.name ?? '')"
        v-text="UAParser(item.userAgent).browser.name"
      />
      <v-chip
        dark
        small
        variant="flat"
        :color="colorFor(UAParser(item.userAgent).os.name ?? '')"
        v-text="UAParser(item.userAgent).os.name"
      />
    </template>
    <template #[`item.suspicious`]="{ item }">
      <v-chip
        :color="item.suspicious ? 'red' : 'green'"
        dark
        small
        variant="flat"
        v-text="item.suspicious ? 'Yes' : 'No'"
      />
    </template>
    <template #[`item.actions`]="{ item }">
      <v-btn icon title="Show details">
        <v-icon>mdi-magnify</v-icon>
        <v-dialog activator="parent" max-width="700">
          <v-card>
            <v-card-title>Details</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="item.level" label="Level" readonly />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="item.subject"
                    label="Subject"
                    readonly
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea v-model="item.message" label="Message" readonly />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    :model-value="new Date(item.time).toLocaleString()"
                    label="Time"
                    readonly
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    :model-value="item.suspicious ? 'Yes' : 'No'"
                    label="Suspicious"
                    readonly
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="item.uid" label="UID" readonly />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="item.requestId"
                    label="Request ID"
                    readonly
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="item.requestUrl"
                    label="Request URL"
                    readonly
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="item.ip" label="IP" readonly />
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="item.userAgent"
                    label="User Agent"
                    readonly
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea v-model="item.details" label="Details" readonly />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-dialog>
      </v-btn>
    </template>
  </v-data-table-server>
</template>

<style scoped></style>
