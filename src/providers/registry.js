import { Hono } from 'hono';
import { lk21Router, metadata as lk21Meta } from './movie/lk21/index.js';
import { kuramanimeRouter, metadata as kuramaMeta } from './anime/kuramanime/index.js';
import { ikiruRouter, metadata as ikiruMeta } from './comic/ikiru/index.js';

/**
 * Provider Registry Definition
 */
export const PROVIDERS = [
  {
    category: 'movie',
    provider: 'lk21',
    isDefault: true,
    meta: lk21Meta,
    router: lk21Router
  },
  {
    category: 'anime',
    provider: 'kuramanime',
    isDefault: true,
    meta: kuramaMeta,
    router: kuramanimeRouter
  },
  {
    category: 'comic',
    provider: 'ikiru',
    isDefault: true,
    meta: ikiruMeta,
    router: ikiruRouter
  },
];

/**
 * Mount all registered providers into the main Hono v1 router
 */
export function registerProviders(v1Router) {
  for (const item of PROVIDERS) {
    // 1. Mount explicit provider route: /api/v1/:category/:provider/*
    const providerPath = `/${item.category}/${item.provider}`;
    v1Router.route(providerPath, item.router);

    // 2. If designated as default provider for this category, mount directly at /api/v1/:category/*
    if (item.isDefault) {
      const defaultCategoryPath = `/${item.category}`;
      v1Router.route(defaultCategoryPath, item.router);
    }
  }
}

export function getProvidersSummary() {
  return PROVIDERS.map((p) => ({
    category: p.category,
    provider: p.provider,
    isDefault: p.isDefault,
    name: p.meta.name,
    version: p.meta.version,
    description: p.meta.description
  }));
}
