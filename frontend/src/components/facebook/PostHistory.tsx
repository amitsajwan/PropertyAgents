import { FacebookPost } from '../../types';

interface PostHistoryProps {
  posts: FacebookPost[];
}

export default function PostHistory({ posts }: PostHistoryProps) {
  if (posts.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Posts</h2>
      
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} className="border-b border-gray-100 pb-3 last:border-0">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-800">{post.text.substring(0, 80)}...</p>
                <time className="text-xs text-gray-500">
                  {new Date(post.created_at).toLocaleString()}
                </time>
              </div>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}