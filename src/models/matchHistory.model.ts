import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';
import User from './user.model';

export class MatchHistory extends Model {
  declare id: number;
  declare playerOneId: number;
  declare playerTwoId: number;
  declare playerOneScore: number;
  declare playerTwoScore: number;
  declare winnerId: number;
  declare playedAt: Date;
}

MatchHistory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    playerOneId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    playerTwoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    playerOneScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    playerTwoScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    winnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    playedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'match_histories',
    timestamps: false, // playedAt acts as our timestamp
  }
);

// Establish relationships (Associations)
User.hasMany(MatchHistory, { foreignKey: 'playerOneId', as: 'MatchesAsPlayerOne' });
User.hasMany(MatchHistory, { foreignKey: 'playerTwoId', as: 'MatchesAsPlayerTwo' });
MatchHistory.belongsTo(User, { foreignKey: 'playerOneId', as: 'PlayerOne' });
MatchHistory.belongsTo(User, { foreignKey: 'playerTwoId', as: 'PlayerTwo' });
MatchHistory.belongsTo(User, { foreignKey: 'winnerId', as: 'Winner' });

export default MatchHistory;
