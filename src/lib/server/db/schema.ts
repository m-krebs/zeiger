import { pgTable, text, boolean, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

export const folder = pgTable(
	'folder',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => [index('folder_user_id_idx').on(t.userId)]
);

export const link = pgTable(
	'link',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		folderId: uuid('folder_id').references(() => folder.id, { onDelete: 'set null' }),
		title: text('title').notNull(),
		url: text('url').notNull(),
		tags: text('tags').array().notNull().default([]),
		public: boolean('public').notNull().default(false),
		short: text('short').notNull().unique(),
		favicon: text('favicon'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [index('link_user_id_idx').on(t.userId)]
);

export const linkVisit = pgTable(
	'link_visit',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		linkId: uuid('link_id')
			.notNull()
			.references(() => link.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		visitedAt: timestamp('visited_at').notNull().defaultNow(),
		userAgent: text('user_agent'),
		referer: text('referer')
	},
	(t) => [index('link_visit_link_id_idx').on(t.linkId)]
);

export type Folder = typeof folder.$inferSelect;
export type Link = typeof link.$inferSelect;
export type LinkVisit = typeof linkVisit.$inferSelect;

export * from './auth.schema';
