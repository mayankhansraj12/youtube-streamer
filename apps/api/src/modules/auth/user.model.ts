import bcrypt from 'bcryptjs';
import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { LIMITS, type PublicUser } from '@streamsync/shared';

const BCRYPT_ROUNDS = 12;

export interface UserAttributes {
  username: string;
  email?: string;
  password: string;
  createdAt: Date;
}

export interface UserMethods {
  matchPassword(candidate: string): Promise<boolean>;
  toPublicJSON(): PublicUser;
}

export type UserModel = Model<UserAttributes, object, UserMethods>;
export type UserDocument = HydratedDocument<UserAttributes, UserMethods>;

const userSchema = new mongoose.Schema<UserAttributes, UserModel, UserMethods>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: LIMITS.minUsernameLength,
      maxlength: LIMITS.maxUsernameLength,
    },
    // Optional. The sparse index lets many accounts omit an email address.
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  { versionKey: false }
);

// Hash only when the password actually changed. Returning early matters: without it
// every unrelated save would hash the stored hash and lock the user out.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.methods.matchPassword = function matchPassword(candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublicJSON = function toPublicJSON(): PublicUser {
  return {
    id: this.id,
    username: this.username,
    email: this.email || null,
    createdAt: this.createdAt.toISOString(),
  };
};

export const User = mongoose.model<UserAttributes, UserModel>('User', userSchema);
