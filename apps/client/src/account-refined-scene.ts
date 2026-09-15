import { AccountCommandScene as BaseAccountCommandScene } from './account-command-scene.ts';

/**
 * Canonical account scene.
 *
 * AccountCommandScene owns the complete ID/password presentation and guest migration
 * flow. Keep this wrapper intentionally thin so another presentation layer cannot
 * re-introduce duplicate credential controls or a retired provider-specific login.
 */
export class AccountScene extends BaseAccountCommandScene {}
