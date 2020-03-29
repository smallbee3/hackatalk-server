import { Dialect, Sequelize } from 'sequelize';

import config from '../../config/config';

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    dialect: config.dialect as Dialect,
    define: config.define,
    dialectOptions: config.dialectOption,
    pool: config.pool,
    logging: (...query) => {
      console.log('\x1b[34m', `\n[${query[1]['model']?.name}] ${query[1]['type']} statement :`);
      console.log('\x1b[36m', query[0], '\n');
    },
  },
);

export default sequelize;
