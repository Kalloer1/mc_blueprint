<script lang="ts" setup>
import { useLocalePath } from '#i18n';
import { toast } from 'vuetify-sonner';

/**
 * 用vue写一个云备份服务的计划选择界面，使用vuetify，注意界面的质感、圆角、渐变色、图标和配色的使用，包括：
 * 免费：无限的本地备份，最多3个备份，每个备份最多1GB
 * 15CNY/月：总计20GB的存档，无限备份数量，每个月下行流量限制15GB
 * 66CNY/月：总计66GB的存档，专属售后服务，支持本地无感备份，可以做到本地不保存备份，云端即时保存即时同步
 * 300CNY/月：专属维护服务，全部无限
 * 单独购买存储空间包：1元/GB/月，预充值
 */
type Plan = {
  key: 'free' | '15' | '66' | '300' | 'storage';
  name: string;
  price: string;
  color: string;
  icon: string;
  iconColor: string;
  elevation: number;
  buttonColor: string;
  features: string[];
  smCols?: number;
  mdCols?: number;
};
const plans: Plan[] = [
  {
    key: 'free',
    name: '免费',
    price: '免费',
    color: '#E0F7FA', // 浅蓝色背景
    icon: 'mdi-cloud-outline',
    iconColor: 'blue',
    elevation: 2,
    buttonColor: 'cyan',
    features: ['无限本地备份', '最多3个云端备份', '每个云端备份最大1GB'],
    smCols: 12,
  },
  {
    key: '15',
    name: '15 CNY/月',
    price: '15 CNY/月',
    color: '#FFFF8D', // 浅黄色背景
    icon: 'mdi-cloud-upload',
    iconColor: '#FBC02D',
    elevation: 4,
    buttonColor: 'amber',
    features: ['总计30GB存档', '无限备份数量', '每月15GB下行流量'],
  },
  {
    key: '66',
    name: '66 CNY/月',
    price: '66 CNY/月',
    color: '#F3E5F5', // 紫色背景
    icon: 'mdi-cloud-sync',
    iconColor: 'purple',
    elevation: 6,
    buttonColor: 'purple',
    features: [
      '总计66GB存档',
      '专属售后服务',
      '备份不保存在本地，适用于存储空间有限的用户',
    ],
  },
  {
    key: '300',
    name: '300 CNY/月',
    price: '300 CNY/月',
    color: '#F8BBD0', // 红色背景
    icon: 'mdi-shield-lock',
    iconColor: 'red',
    elevation: 8,
    buttonColor: 'red',
    features: ['专属维护服务', '所有功能无限'],
  },
  {
    key: 'storage',
    name: '存储空间包',
    price: '1元/GB/月',
    color: '#E0F2F1', // 粉色背景
    icon: 'mdi-database-plus',
    iconColor: 'teal',
    elevation: 3,
    buttonColor: 'teal',
    features: ['1元/GB/月', '另包含每月1GB的下载流量'],
  },
];
const router = useRouter();
const localePath = useLocalePath();

function goToCheckout(key: Plan['key']) {
  if (key === 'free') {
    router.push(localePath('/x-backup/me'));
  } else {
    toast.primary('暂不支持此计划');
  }
}
</script>

<template>
  <v-app>
    <v-container class="pa-5" fluid>
      <v-row class="d-flex justify-center">
        <v-col
          v-for="plan in plans"
          :key="plan.name"
          :md="plan.mdCols ?? 4"
          :sm="plan.smCols ?? 6"
          cols="12"
        >
          <v-card
            :color="plan.color"
            :elevation="plan.elevation"
            class="pa-4 rounded-xl"
            hover
            outlined
          >
            <v-card-title class="text-center display-1 font-weight-bold">
              <v-icon :color="plan.iconColor">{{ plan.icon }}</v-icon>
              {{ plan.name }}
            </v-card-title>
            <v-card-subtitle class="text-center">
              {{ plan.price }}
            </v-card-subtitle>
            <v-divider></v-divider>
            <v-card-text class="text-center">
              <div v-for="feature in plan.features" :key="feature" class="my-2">
                <v-icon :color="plan.iconColor" class="mr-2"
                  >mdi-check-circle
                </v-icon>
                {{ feature }}
              </div>
            </v-card-text>
            <v-btn
              :color="plan.buttonColor"
              block
              @click="goToCheckout(plan.key)"
              >选择此计划
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-app>
</template>

<style scoped></style>
