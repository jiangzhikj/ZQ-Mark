import { Mathematics } from '@tiptap/extension-mathematics';

export const MathExtension = Mathematics.configure({
  katexOptions: {
    throwOnError: false,
  },
});

export default MathExtension;
