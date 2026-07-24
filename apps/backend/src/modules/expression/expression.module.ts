import { Module } from '@nestjs/common';
import { ExpressionController } from './expression.controller';
import { ExpressionService } from './expression.service';
import { LearningNotebookController } from './learning-notebook.controller';
import { LearningNotebookService } from './learning-notebook.service';

@Module({
  controllers: [ExpressionController, LearningNotebookController],
  providers: [ExpressionService, LearningNotebookService],
  exports: [ExpressionService, LearningNotebookService],
})
export class ExpressionModule {}
