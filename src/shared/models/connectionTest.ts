import { Document, Model, model, Schema } from 'mongoose';

const testMongoSchema = new Schema<ConnectionTestDocument>({
  start: { type: Date, require: true, default: Date.now },
  options: { type: JSON, require: true },
});

interface ConnectionTestDocument extends Document {
  start?: Date;
  options: any;
}

const ConnectionTestMongo = model<
  ConnectionTestDocument,
  Model<ConnectionTestDocument>
>('TestModel', testMongoSchema);

export default ConnectionTestMongo;
