import { MongoCriteriaConverter } from './criteria-converter.mongo';
import { MongodbTestService } from '../testing/mongodb-test.service';
import {
  testCriteriaConverterContract,
  type TestEntityDTO,
} from '@libs/nestjs-common/test-exports';

describe('MongoCriteriaConverter', () => {
  const mongoTestService = new MongodbTestService<TestEntityDTO>('test_entities');

  beforeAll(async () => {
    await mongoTestService.setupDatabase();
  });

  beforeEach(async () => {
    await mongoTestService.clearCollection();
  });

  afterAll(async () => {
    await mongoTestService.cleanup();
  });

  // Run the shared contract tests
  testCriteriaConverterContract('MongoDB Implementation', async (entities: TestEntityDTO[]) => {
    await mongoTestService.setInitialData(entities);
    const collection = mongoTestService.getCollection();
    return new MongoCriteriaConverter(collection);
  });
});
