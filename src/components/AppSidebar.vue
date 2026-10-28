<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useColorMode } from '@vueuse/core'
import {
  BookOpen,
  ChevronsUpDown,
  Database,
  Info,
  Link,
  LogOut,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Sun,
  Tag,
  Trash2,
} from '@lucide/vue'

import AppLogo from '@/components/AppLogo.vue'
import CreateKnowledgeBaseDialog from '@/components/CreateKnowledgeBaseDialog.vue'
import DeleteKnowledgeBaseDialog from '@/components/DeleteKnowledgeBaseDialog.vue'
import RenameKnowledgeBaseDialog from '@/components/RenameKnowledgeBaseDialog.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import type { KnowledgeBase } from '@/api/knowledgeBases'
import { useAuthStore } from '@/stores/auth'
import { useKnowledgeBasesStore } from '@/stores/knowledgeBases'

// Tags, links and sources belong to the user, not to a knowledge base; tags and links have no page yet
const upcomingLibraryItems = [
  { label: 'Tags', icon: Tag },
  { label: 'Liens', icon: Link },
]

const auth = useAuthStore()
const knowledgeBases = useKnowledgeBasesStore()
const route = useRoute()
const router = useRouter()
const colorMode = useColorMode()
const { setOpenMobile } = useSidebar()

// On mobile the sidebar is a sheet over the page: close it once a link is followed
watch(
  () => route.fullPath,
  () => setOpenMobile(false),
)

const createOpen = ref(false)
const renameOpen = ref(false)
const kbToRename = ref<KnowledgeBase | null>(null)
const deleteOpen = ref(false)
const kbToDelete = ref<KnowledgeBase | null>(null)

function askRename(kb: KnowledgeBase) {
  kbToRename.value = kb
  renameOpen.value = true
}

function askDelete(kb: KnowledgeBase) {
  kbToDelete.value = kb
  deleteOpen.value = true
}

function toggleColorMode() {
  colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
}

async function logout() {
  auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <RouterLink :to="{ name: 'knowledge-bases' }">
              <!-- size-8! beats the menu button's [&>svg]:size-4 -->
              <AppLogo class="size-8! p-0.5" />
              <span class="font-heading text-base font-semibold">Particule</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Bases de connaissances</SidebarGroupLabel>
        <SidebarGroupAction title="Nouvelle base" @click="createOpen = true">
          <Plus />
          <span class="sr-only">Nouvelle base</span>
        </SidebarGroupAction>
        <SidebarGroupContent>
          <SidebarMenu>
            <template v-if="!knowledgeBases.loaded">
              <SidebarMenuItem v-for="n in 3" :key="n">
                <SidebarMenuSkeleton show-icon />
              </SidebarMenuItem>
            </template>

            <SidebarMenuItem v-for="kb in knowledgeBases.items" :key="kb.id">
              <SidebarMenuButton
                as-child
                :tooltip="kb.name"
                :is-active="route.params.kbId === kb.id"
              >
                <RouterLink :to="{ name: 'knowledge-base', params: { kbId: kb.id } }">
                  <Database />
                  <span>{{ kb.name }}</span>
                </RouterLink>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <SidebarMenuAction show-on-hover>
                    <MoreHorizontal />
                    <span class="sr-only">Actions sur {{ kb.name }}</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                  <DropdownMenuItem @select="askRename(kb)">
                    <Pencil />
                    Renommer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" @select="askDelete(kb)">
                    <Trash2 />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>

            <SidebarMenuItem v-if="knowledgeBases.loaded">
              <SidebarMenuButton
                class="text-sidebar-foreground/70"
                tooltip="Nouvelle base"
                @click="createOpen = true"
              >
                <Plus />
                <span>Ajouter une base</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Bibliothèque</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child tooltip="Sources" :is-active="route.name === 'sources'">
                <RouterLink :to="{ name: 'sources' }">
                  <BookOpen />
                  <span>Sources</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem v-for="item in upcomingLibraryItems" :key="item.label">
              <SidebarMenuButton :tooltip="item.label" aria-disabled="true">
                <component :is="item.icon" />
                <span>{{ item.label }}</span>
              </SidebarMenuButton>
              <SidebarMenuBadge class="text-sidebar-foreground/50">Bientôt</SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                size="lg"
                class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div
                  class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent font-semibold uppercase"
                >
                  {{ (auth.user?.full_name || auth.user?.email || '?').charAt(0) }}
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-medium">{{
                    auth.user?.full_name || 'Mon compte'
                  }}</span>
                  <span class="truncate text-xs text-sidebar-foreground/70">
                    {{ auth.user?.email }}
                  </span>
                </div>
                <ChevronsUpDown class="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              class="w-(--reka-dropdown-menu-trigger-width) min-w-56"
            >
              <DropdownMenuLabel class="truncate">{{ auth.user?.email }}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="toggleColorMode">
                <Sun v-if="colorMode === 'dark'" />
                <Moon v-else />
                {{ colorMode === 'dark' ? 'Thème clair' : 'Thème sombre' }}
              </DropdownMenuItem>
              <DropdownMenuItem as-child>
                <RouterLink :to="{ name: 'about' }">
                  <Info />
                  À propos
                </RouterLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="logout">
                <LogOut />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>

  <CreateKnowledgeBaseDialog v-model:open="createOpen" />
  <RenameKnowledgeBaseDialog v-model:open="renameOpen" :knowledge-base="kbToRename" />
  <DeleteKnowledgeBaseDialog v-model:open="deleteOpen" :knowledge-base="kbToDelete" />
</template>
