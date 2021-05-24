const { JsonWebTokenError } = require("jsonwebtoken");
const Sequelize = require("sequelize");
const { STRING } = Sequelize;
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || "postgres://localhost/acme_db",
  config
);

const User = conn.define(
  "user",
  {
    username: STRING,
    password: STRING,
  },
  {
    hooks: {
      beforeCreate: async (user) => {

        if (user.password) {
          const salt = await bcrypt.genSaltSync(10);
          const hash = bcrypt.hashSync(user.password, salt);
          user.password = hash;
        }
      },
    },
  }
);

const Note = conn.define(
  "note",
  {
    text: {
      type: STRING,
    },
  }

);

Note.belongsTo(User);
User.hasMany(Note);

User.byToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT);

    if (decoded.userId) {
      user = await User.findByPk(decoded.userId);
      return user;
    }
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });
  if (user) {
    if (await bcrypt.compare(password, user.password)) {
      return jwt.sign({ userId: user.id }, process.env.JWT);
    }
  }
  const error = Error("bad wha");
  error.status = 401;
  throw error;
};

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: "lucy", password: "lucy_pw" },
    { username: "moe", password: "moe_pw" },
    { username: "larry", password: "larry_pw" },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );

  const notes = [
    { text: "hello world" },
    { text: "reminder to buy groceries" },
    { text: "reminder to do laundry" },
  ];
  const [note1, note2, note3] = await Promise.all(
    notes.map((note) => Note.create(note))
  );
  await lucy.setNotes(note1);
  await moe.setNotes([note2, note3]);

  return {
    users: {
      lucy,
      moe,
      larry,
    },
    notes: {
      note1,
      note2,
      note3,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};

