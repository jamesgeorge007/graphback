import { unlinkSync } from 'fs';
import { GlobSync } from 'glob';
import { printSchema } from 'graphql';
import { DatabaseSchemaManager, migrate } from 'graphql-migrations';
import * as knex from 'knex';
import { join } from 'path';
import { ConfigBuilder } from '../config/ConfigBuilder';
import { logError, logInfo } from '../utils'
import { checkDirectory } from './common'
import { loadSchema } from './loadSchema';

const handleError = (err: { code: string; message: string; }): void => {
  if (err.code === 'ECONNREFUSED') {
    logError('Database not running. Run docker-compose up -d or docker-compose start to start the database.')
  } else {
    logError(err.message)
  }
  process.exit(0)
}

export const dropDBResources = async (configInstance: ConfigBuilder): Promise<void> => {
  try {
    const { database, dbConfig } = configInstance.config.db
    if (database === 'sqlite3') {
      const sqliteFile = new GlobSync('*.sqlite', { cwd: process.cwd() })
      if (sqliteFile.found.length) {
        unlinkSync(`${process.cwd()}/${sqliteFile.found[0]}`)
      }
    } else {
      const manager = new DatabaseSchemaManager(database, dbConfig);

      // tslint:disable-next-line: await-promise
      await manager.getConnection().raw('DROP SCHEMA public CASCADE;')
      // tslint:disable-next-line: await-promise
      await manager.getConnection().raw('CREATE SCHEMA public;')
    }

  } catch (err) {
    handleError(err)
  }
}

export const createDBResources = async (configInstance: ConfigBuilder, db: knex<any, unknown[]>): Promise<void> => {
  try {
    const { folders } = configInstance.config

    const models = new GlobSync(`${folders.model}/*.graphql`)

    if (models.found.length === 0) {
      logError(`No graphql file found inside ${process.cwd()}/model folder.`)
      process.exit(0)
    }

    const schema = await loadSchema();
    const schemaText = printSchema(schema);

    await migrate(schemaText, db, { migrationsDir: folders.migrations });

  } catch (err) {
    handleError(err)
  }
}

export const postCommandMessage = (message: string) => {
  logInfo(message);
}

export const createDB = async (db: knex<any, unknown[]>): Promise<void> => {
  const configInstance = new ConfigBuilder();
  checkDirectory(configInstance)

  await createDBResources(configInstance, db)
}

// tslint:disable-next-line: no-any
export async function connect(client: string, connection: any) {
  return knex({
    client,
    connection
  }) as any
}
