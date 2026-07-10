import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';

export class User extends Model {
  declare id: number;
  declare username: string;
  declare email: string;
  declare passwordHash: string;
  declare level: number;
  declare totalWins: number;
  declare totalLosses: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    totalWins: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    totalLosses: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
  }
);

export default User;
